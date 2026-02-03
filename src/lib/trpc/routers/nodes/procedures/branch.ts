import { repositories, nodes } from "lib/local-db";
import { and, eq, isNull } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { getNodeRuntimeRegistry } from "main/lib/node-runtime";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import {
	getBranchNode,
	getNode,
	setLastActiveNode,
	touchNode,
} from "../utils/db-helpers";
import { listBranches, safeCheckoutBranch } from "../utils/git";

export const createBranchProcedures = () => {
	return router({
		getBranches: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					fetch: z.boolean().optional(), // Whether to fetch remote refs (default: false, avoids UI stalls)
				}),
			)
			.query(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				const branches = await listBranches(repository.mainRepoPath, {
					fetch: input.fetch,
				});

				// Get branches that are in use by worktrees, with their node IDs
				const repositoryNodes = localDb
					.select()
					.from(nodes)
					.where(
						and(
							eq(nodes.repositoryId, input.repositoryId),
							isNull(nodes.deletingAt),
						),
					)
					.all();
				const worktreeBranchMap: Record<string, string> = {};
				for (const n of repositoryNodes) {
					if (n.type === "worktree" && n.branch) {
						worktreeBranchMap[n.branch] = n.id;
					}
				}

				return {
					...branches,
					inUse: Object.keys(worktreeBranchMap),
					inUseNodes: worktreeBranchMap, // branch -> nodeId
				};
			}),

		// Switch an existing branch node to a different branch
		switchBranchNode: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					branch: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				const node = getBranchNode(input.repositoryId);
				if (!node) {
					throw new Error("No branch node found for this repository");
				}

				// Checkout the new branch with safety checks (terminals continue running on the new branch)
				await safeCheckoutBranch(repository.mainRepoPath, input.branch);

				// Send newline to terminals so their prompts refresh with new branch
				getNodeRuntimeRegistry()
					.getForNodeId(node.id)
					.terminal.refreshPromptsForWorkspace(node.id);

				// Update the node - name is always the branch for branch nodes
				touchNode(node.id, {
					branch: input.branch,
					name: input.branch,
				});
				setLastActiveNode(node.id);

				const updatedNode = getNode(node.id);
				if (!updatedNode) {
					throw new Error(`Node ${node.id} not found after update`);
				}

				return {
					node: updatedNode,
					worktreePath: repository.mainRepoPath,
				};
			}),
	});
};
