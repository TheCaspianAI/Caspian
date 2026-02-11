import { TRPCError } from "@trpc/server";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { nodes, repositories, worktrees } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import { getRepositoryHealth } from "../../repositories/utils/health-cache";
import { getNode } from "../utils/db-helpers";
import { detectBaseBranch, hasOriginRemote } from "../utils/git";
import { getNodePath } from "../utils/worktree";

type WorktreePathMap = Map<string, string>;

/** Returns node IDs in sidebar visual order (by repository.tabOrder, then node.tabOrder). */
function getNodesInVisualOrder(): string[] {
	const activeRepositories = localDb
		.select()
		.from(repositories)
		.where(isNotNull(repositories.tabOrder))
		.all()
		.sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));

	const allNodes = localDb.select().from(nodes).where(isNull(nodes.deletingAt)).all();

	const orderedIds: string[] = [];
	for (const repository of activeRepositories) {
		const repositoryNodes = allNodes
			.filter((n) => n.repositoryId === repository.id)
			.sort((a, b) => a.tabOrder - b.tabOrder);
		for (const n of repositoryNodes) {
			orderedIds.push(n.id);
		}
	}

	return orderedIds;
}

export const createQueryProcedures = () => {
	return router({
		get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
			const node = getNode(input.id);
			if (!node) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Node ${input.id} not found`,
				});
			}

			const repository = localDb
				.select()
				.from(repositories)
				.where(eq(repositories.id, node.repositoryId))
				.get();
			const worktree = node.worktreeId
				? localDb.select().from(worktrees).where(eq(worktrees.id, node.worktreeId)).get()
				: null;

			// Detect and persist base branch for existing worktrees that don't have it
			// We use undefined to mean "not yet attempted" and null to mean "attempted but not found"
			let baseBranch = worktree?.baseBranch;
			if (worktree && baseBranch === undefined && repository) {
				// Only attempt detection if there's a remote origin
				const hasRemote = await hasOriginRemote(repository.mainRepoPath);
				if (hasRemote) {
					try {
						const defaultBranch = repository.defaultBranch || "main";
						const detected = await detectBaseBranch(worktree.path, worktree.branch, defaultBranch);
						if (detected) {
							baseBranch = detected;
						}
						// Persist the result (detected branch or null sentinel)
						localDb
							.update(worktrees)
							.set({ baseBranch: detected ?? null })
							.where(eq(worktrees.id, worktree.id))
							.run();
					} catch {
						// Detection failed, persist null to avoid retrying
						localDb
							.update(worktrees)
							.set({ baseBranch: null })
							.where(eq(worktrees.id, worktree.id))
							.run();
					}
				} else {
					// No remote - persist null to avoid retrying
					localDb
						.update(worktrees)
						.set({ baseBranch: null })
						.where(eq(worktrees.id, worktree.id))
						.run();
				}
			}

			const repoHealth = repository ? getRepositoryHealth({ repositoryId: repository.id }) : null;

			return {
				...node,
				type: node.type as "worktree" | "branch",
				worktreePath: getNodePath(node) ?? "",
				repository: repository
					? {
							id: repository.id,
							name: repository.name,
							mainRepoPath: repository.mainRepoPath,
							pathMissing: repoHealth ? !repoHealth.healthy : false,
						}
					: null,
				worktree: worktree
					? {
							branch: worktree.branch,
							baseBranch,
							// Normalize to null to ensure consistent "incomplete init" detection in UI
							gitStatus: worktree.gitStatus ?? null,
						}
					: null,
			};
		}),

		getAll: publicProcedure.query(() => {
			return localDb
				.select()
				.from(nodes)
				.where(isNull(nodes.deletingAt))
				.all()
				.sort((a, b) => a.tabOrder - b.tabOrder);
		}),

		getAllGrouped: publicProcedure.query(() => {
			const activeRepositories = localDb
				.select()
				.from(repositories)
				.where(isNotNull(repositories.tabOrder))
				.all();

			// Preload all worktrees once to avoid N+1 queries in the loop below
			const allWorktrees = localDb.select().from(worktrees).all();
			const worktreePathMap: WorktreePathMap = new Map(allWorktrees.map((wt) => [wt.id, wt.path]));

			const groupsMap = new Map<
				string,
				{
					repository: {
						id: string;
						name: string;
						color: string;
						tabOrder: number;
						githubOwner: string | null;
						mainRepoPath: string;
						defaultBranch: string;
						pathMissing: boolean;
					};
					nodes: Array<{
						id: string;
						repositoryId: string;
						worktreeId: string | null;
						worktreePath: string;
						type: "worktree" | "branch";
						branch: string;
						name: string;
						tabOrder: number;
						createdAt: number;
						updatedAt: number;
						lastOpenedAt: number;
						isUnread: boolean;
					}>;
				}
			>();

			for (const repository of activeRepositories) {
				const health = getRepositoryHealth({ repositoryId: repository.id });
				groupsMap.set(repository.id, {
					repository: {
						id: repository.id,
						name: repository.name,
						color: repository.color,
						tabOrder: repository.tabOrder!,
						githubOwner: repository.githubOwner ?? null,
						mainRepoPath: repository.mainRepoPath,
						defaultBranch: repository.defaultBranch ?? "main",
						pathMissing: !health.healthy,
					},
					nodes: [],
				});
			}

			const allNodes = localDb
				.select()
				.from(nodes)
				.where(isNull(nodes.deletingAt))
				.all()
				.sort((a, b) => a.tabOrder - b.tabOrder);

			for (const node of allNodes) {
				const group = groupsMap.get(node.repositoryId);
				if (group) {
					// Resolve path from preloaded data instead of per-node DB queries
					let worktreePath = "";
					if (node.type === "worktree" && node.worktreeId) {
						worktreePath = worktreePathMap.get(node.worktreeId) ?? "";
					} else if (node.type === "branch") {
						worktreePath = group.repository.mainRepoPath;
					}

					group.nodes.push({
						...node,
						type: node.type as "worktree" | "branch",
						worktreePath,
						isUnread: node.isUnread ?? false,
					});
				}
			}

			return Array.from(groupsMap.values()).sort(
				(a, b) => a.repository.tabOrder - b.repository.tabOrder,
			);
		}),

		getPreviousNode: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
			const orderedNodeIds = getNodesInVisualOrder();
			if (orderedNodeIds.length === 0) return null;

			const currentIndex = orderedNodeIds.indexOf(input.id);
			if (currentIndex === -1) return null;

			const prevIndex = currentIndex === 0 ? orderedNodeIds.length - 1 : currentIndex - 1;
			return orderedNodeIds[prevIndex];
		}),

		getNextNode: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
			const orderedNodeIds = getNodesInVisualOrder();
			if (orderedNodeIds.length === 0) return null;

			const currentIndex = orderedNodeIds.indexOf(input.id);
			if (currentIndex === -1) return null;

			const nextIndex = currentIndex === orderedNodeIds.length - 1 ? 0 : currentIndex + 1;
			return orderedNodeIds[nextIndex];
		}),
	});
};
