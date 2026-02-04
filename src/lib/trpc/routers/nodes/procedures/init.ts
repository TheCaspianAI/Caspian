import { observable } from "@trpc/server/observable";
import { settings } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { nodeInitManager } from "main/lib/node-init-manager";
import type { NodeInitProgress } from "shared/types/node-init";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import { getNodeWithRelations, getRepository } from "../utils/db-helpers";
import { initializeNodeWorktree } from "../utils/node-init";
import { loadSetupConfig } from "../utils/setup";

function getDefaultPreset() {
	const row = localDb.select().from(settings).get();
	if (!row) return null;
	const presets = row.terminalPresets ?? [];
	return presets.find((p) => p.isDefault) ?? null;
}

export const createInitProcedures = () => {
	return router({
		onInitProgress: publicProcedure
			.input(z.object({ nodeIds: z.array(z.string()).optional() }).optional())
			.subscription(({ input }) => {
				return observable<NodeInitProgress>((emit) => {
					const handler = (progress: NodeInitProgress) => {
						if (input?.nodeIds && !input.nodeIds.includes(progress.nodeId)) {
							return;
						}
						emit.next(progress);
					};

					for (const progress of nodeInitManager.getAllProgress()) {
						if (!input?.nodeIds || input.nodeIds.includes(progress.nodeId)) {
							emit.next(progress);
						}
					}

					nodeInitManager.on("progress", handler);

					return () => {
						nodeInitManager.off("progress", handler);
					};
				});
			}),

		retryInit: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.mutation(async ({ input }) => {
				const relations = getNodeWithRelations(input.nodeId);

				if (!relations) {
					throw new Error("Node not found");
				}

				const { node, worktree, repository } = relations;

				if (node.deletingAt) {
					throw new Error("Cannot retry initialization on a node being deleted");
				}

				if (!worktree) {
					throw new Error("Worktree not found");
				}

				if (!repository) {
					throw new Error("Repository not found");
				}

				nodeInitManager.clearJob(input.nodeId);
				nodeInitManager.startJob(input.nodeId, node.repositoryId);

				// baseBranch is treated as explicit on retry to prevent further auto-correction
				initializeNodeWorktree({
					nodeId: input.nodeId,
					repositoryId: node.repositoryId,
					worktreeId: worktree.id,
					worktreePath: worktree.path,
					branch: worktree.branch,
					baseBranch: worktree.baseBranch ?? repository.defaultBranch ?? "main",
					baseBranchWasExplicit: true,
					mainRepoPath: repository.mainRepoPath,
				});

				return { success: true };
			}),

		getInitProgress: publicProcedure.input(z.object({ nodeId: z.string() })).query(({ input }) => {
			return nodeInitManager.getProgress(input.nodeId) ?? null;
		}),

		getSetupCommands: publicProcedure.input(z.object({ nodeId: z.string() })).query(({ input }) => {
			const relations = getNodeWithRelations(input.nodeId);

			if (!relations) {
				return null;
			}

			const repository = getRepository(relations.node.repositoryId);

			if (!repository) {
				return null;
			}

			const setupConfig = loadSetupConfig(repository.mainRepoPath);
			const defaultPreset = getDefaultPreset();

			return {
				repositoryId: repository.id,
				initialCommands: setupConfig?.setup ?? null,
				defaultPreset,
			};
		}),
	});
};
