import { and, eq, isNull } from "drizzle-orm";
import { nodes, worktrees } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import {
	getNode,
	getRepository,
	getWorktree,
	touchNode,
	updateRepositoryDefaultBranch,
} from "../utils/db-helpers";
import {
	checkNeedsRebase,
	fetchDefaultBranch,
	getCurrentBranch,
	getDefaultBranch,
	refreshDefaultBranch,
} from "../utils/git";
import { fetchGitHubPRStatus } from "../utils/github";

export const createGitStatusProcedures = () => {
	return router({
		refreshGitStatus: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.mutation(async ({ input }) => {
				const node = getNode(input.nodeId);
				if (!node) {
					throw new Error(`Node ${input.nodeId} not found`);
				}

				const worktree = node.worktreeId ? getWorktree(node.worktreeId) : null;
				if (!worktree) {
					throw new Error(`Worktree for node ${input.nodeId} not found`);
				}

				const repository = getRepository(node.repositoryId);
				if (!repository) {
					throw new Error(`Repository ${node.repositoryId} not found`);
				}

				// Sync with remote in case the default branch changed (e.g. master -> main)
				const remoteDefaultBranch = await refreshDefaultBranch(repository.mainRepoPath);

				let defaultBranch = repository.defaultBranch;
				if (!defaultBranch) {
					defaultBranch = await getDefaultBranch(repository.mainRepoPath);
				}
				if (remoteDefaultBranch && remoteDefaultBranch !== defaultBranch) {
					defaultBranch = remoteDefaultBranch;
				}

				if (defaultBranch !== repository.defaultBranch) {
					updateRepositoryDefaultBranch(repository.id, defaultBranch);
				}

				// Fetch default branch to get latest
				await fetchDefaultBranch(repository.mainRepoPath, defaultBranch);

				// Check if worktree branch is behind origin/{defaultBranch}
				const needsRebase = await checkNeedsRebase(worktree.path, defaultBranch);

				const gitStatus = {
					branch: worktree.branch,
					needsRebase,
					lastRefreshed: Date.now(),
				};

				// Update worktree in db
				localDb.update(worktrees).set({ gitStatus }).where(eq(worktrees.id, worktree.id)).run();

				return { gitStatus, defaultBranch };
			}),

		getGitHubStatus: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.query(async ({ input }) => {
				const node = getNode(input.nodeId);
				if (!node) {
					return null;
				}

				const worktree = node.worktreeId ? getWorktree(node.worktreeId) : null;
				if (!worktree) {
					return null;
				}

				let branchRenamed: { from: string; to: string } | null = null;
				const actualBranch = await getCurrentBranch(worktree.path);

				if (actualBranch && actualBranch !== worktree.branch) {
					branchRenamed = { from: worktree.branch, to: actualBranch };

					const worktreeUpdate: { branch: string; gitStatus?: typeof worktree.gitStatus } = {
						branch: actualBranch,
					};
					if (worktree.gitStatus) {
						worktreeUpdate.gitStatus = { ...worktree.gitStatus, branch: actualBranch };
					}
					localDb.update(worktrees).set(worktreeUpdate).where(eq(worktrees.id, worktree.id)).run();

					// Only update display name if it still matches the old branch (not custom)
					touchNode(node.id, {
						branch: actualBranch,
						...(node.name === worktree.branch ? { name: actualBranch } : {}),
					});

					console.log(
						`[git-status/getGitHubStatus] Branch renamed: ${worktree.branch} -> ${actualBranch} (node ${node.id})`,
					);
				}

				const freshStatus = await fetchGitHubPRStatus(worktree.path);

				if (freshStatus) {
					localDb
						.update(worktrees)
						.set({ githubStatus: freshStatus })
						.where(eq(worktrees.id, worktree.id))
						.run();
				}

				return { status: freshStatus, branchRenamed };
			}),

		getWorktreeInfo: publicProcedure.input(z.object({ nodeId: z.string() })).query(({ input }) => {
			const node = getNode(input.nodeId);
			if (!node) {
				return null;
			}

			const worktree = node.worktreeId ? getWorktree(node.worktreeId) : null;
			if (!worktree) {
				return null;
			}

			// Extract worktree name from path (last segment)
			const worktreeName = worktree.path.split("/").pop() ?? worktree.branch;

			return {
				worktreeName,
				createdAt: worktree.createdAt,
				gitStatus: worktree.gitStatus ?? null,
				githubStatus: worktree.githubStatus ?? null,
			};
		}),

		getWorktreesByRepository: publicProcedure
			.input(z.object({ repositoryId: z.string() }))
			.query(({ input }) => {
				const repositoryWorktrees = localDb
					.select()
					.from(worktrees)
					.where(eq(worktrees.repositoryId, input.repositoryId))
					.all();

				return repositoryWorktrees.map((wt) => {
					const node = localDb
						.select()
						.from(nodes)
						.where(and(eq(nodes.worktreeId, wt.id), isNull(nodes.deletingAt)))
						.get();
					return {
						...wt,
						hasActiveNode: node !== undefined,
						node: node ?? null,
					};
				});
			}),
	});
};
