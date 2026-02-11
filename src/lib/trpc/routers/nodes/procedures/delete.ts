import type { SelectWorktree } from "lib/local-db";
import { track } from "main/lib/analytics";
import { nodeInitManager } from "main/lib/node-init-manager";
import { getNodeRuntimeRegistry } from "main/lib/node-runtime";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import {
	clearNodeDeletingStatus,
	deleteNode,
	deleteWorktreeRecord,
	getNode,
	getRepository,
	getWorktree,
	hideRepositoryIfNoNodes,
	markNodeAsDeleting,
	updateActiveNodeIfRemoved,
} from "../utils/db-helpers";
import {
	hasUncommittedChanges,
	hasUnpushedCommits,
	removeWorktree,
	worktreeExists,
} from "../utils/git";
import { runTeardown } from "../utils/teardown";
import { invalidateWorktreePathCache } from "../utils/worktree-path-cache";

export const createDeleteProcedures = () => {
	return router({
		canDelete: publicProcedure
			.input(
				z.object({
					id: z.string(),
					// Skip expensive git checks (status, unpushed) during polling - only check terminal count
					skipGitChecks: z.boolean().optional(),
				}),
			)
			.query(async ({ input }) => {
				const node = getNode(input.id);

				if (!node) {
					return {
						canDelete: false,
						reason: "Node not found",
						node: null,
						activeTerminalCount: 0,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				if (node.deletingAt) {
					return {
						canDelete: false,
						reason: "Deletion already in progress",
						node: null,
						activeTerminalCount: 0,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				const activeTerminalCount = await getNodeRuntimeRegistry()
					.getForNodeId(input.id)
					.terminal.getSessionCountByWorkspaceId(input.id);

				// Branch nodes are non-destructive to close - no git checks needed
				if (node.type === "branch") {
					return {
						canDelete: true,
						reason: null,
						node,
						warning: null,
						activeTerminalCount,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				// Polling uses skipGitChecks to avoid expensive git operations
				if (input.skipGitChecks) {
					return {
						canDelete: true,
						reason: null,
						node,
						warning: null,
						activeTerminalCount,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				const worktree = node.worktreeId ? getWorktree(node.worktreeId) : null;
				const repository = getRepository(node.repositoryId);

				if (worktree && repository) {
					try {
						const exists = await worktreeExists(repository.mainRepoPath, worktree.path);

						if (!exists) {
							return {
								canDelete: true,
								reason: null,
								node,
								warning: "Worktree not found in git (may have been manually removed)",
								activeTerminalCount,
								hasChanges: false,
								hasUnpushedCommits: false,
							};
						}

						const [hasChanges, unpushedCommits] = await Promise.all([
							hasUncommittedChanges(worktree.path),
							hasUnpushedCommits(worktree.path),
						]);

						return {
							canDelete: true,
							reason: null,
							node,
							warning: null,
							activeTerminalCount,
							hasChanges,
							hasUnpushedCommits: unpushedCommits,
						};
					} catch (error) {
						return {
							canDelete: false,
							reason: `Failed to check worktree status: ${error instanceof Error ? error.message : String(error)}`,
							node,
							activeTerminalCount,
							hasChanges: false,
							hasUnpushedCommits: false,
						};
					}
				}

				return {
					canDelete: true,
					reason: null,
					node,
					warning: "No associated worktree found",
					activeTerminalCount,
					hasChanges: false,
					hasUnpushedCommits: false,
				};
			}),

		delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
			const node = getNode(input.id);

			if (!node) {
				return { success: false, error: "Node not found" };
			}

			markNodeAsDeleting(input.id);
			updateActiveNodeIfRemoved(input.id);

			// Wait for any ongoing init to complete to avoid racing git operations
			if (nodeInitManager.isInitializing(input.id)) {
				console.log(`[node/delete] Cancelling init for ${input.id}, waiting for completion...`);
				nodeInitManager.cancel(input.id);
				try {
					await nodeInitManager.waitForInit(input.id, 30000);
				} catch (error) {
					// Clear deleting status so node reappears in UI
					console.error(`[node/delete] Failed to wait for init cancellation:`, error);
					clearNodeDeletingStatus(input.id);
					return {
						success: false,
						error: "Failed to cancel node initialization. Please try again.",
					};
				}
			}

			// Kill all terminal processes in this node first
			const terminalResult = await getNodeRuntimeRegistry()
				.getForNodeId(input.id)
				.terminal.killByWorkspaceId(input.id);

			const repository = getRepository(node.repositoryId);

			let worktree: SelectWorktree | undefined;

			if (node.type === "worktree" && node.worktreeId) {
				worktree = getWorktree(node.worktreeId);

				if (worktree && repository) {
					// Prevents racing with concurrent init operations
					await nodeInitManager.acquireRepositoryLock(repository.id);

					try {
						const exists = await worktreeExists(repository.mainRepoPath, worktree.path);

						if (exists) {
							const teardownResult = await runTeardown(
								repository.mainRepoPath,
								worktree.path,
								node.name,
								node.customTeardownScript,
							);
							if (!teardownResult.success) {
								console.error(`Teardown failed for node ${node.name}:`, teardownResult.error);
							}
						}

						try {
							if (exists) {
								await removeWorktree(repository.mainRepoPath, worktree.path);
							} else {
								console.warn(`Worktree ${worktree.path} not found in git, skipping removal`);
							}
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : String(error);
							console.error("Failed to remove worktree:", errorMessage);
							clearNodeDeletingStatus(input.id);
							return {
								success: false,
								error: `Failed to remove worktree: ${errorMessage}`,
							};
						}
					} finally {
						nodeInitManager.releaseRepositoryLock(repository.id);
					}
				}
			}

			deleteNode(input.id);

			if (worktree) {
				deleteWorktreeRecord(worktree.id);
				invalidateWorktreePathCache();
			}

			if (repository) {
				hideRepositoryIfNoNodes(node.repositoryId);
			}

			const terminalWarning =
				terminalResult.failed > 0
					? `${terminalResult.failed} terminal process(es) may still be running`
					: undefined;

			track("node_deleted", { node_id: input.id });

			// Clear after cleanup so cancellation signals remain visible during deletion
			nodeInitManager.clearJob(input.id);

			return { success: true, terminalWarning };
		}),

		close: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
			const node = getNode(input.id);

			if (!node) {
				throw new Error("Node not found");
			}

			const terminalResult = await getNodeRuntimeRegistry()
				.getForNodeId(input.id)
				.terminal.killByWorkspaceId(input.id);

			deleteNode(input.id); // keeps worktree on disk
			hideRepositoryIfNoNodes(node.repositoryId);
			updateActiveNodeIfRemoved(input.id);

			const terminalWarning =
				terminalResult.failed > 0
					? `${terminalResult.failed} terminal process(es) may still be running`
					: undefined;

			track("node_closed", { node_id: input.id });

			return { success: true, terminalWarning };
		}),

		// Check if a closed worktree (no active node) can be deleted
		canDeleteWorktree: publicProcedure
			.input(
				z.object({
					worktreeId: z.string(),
					skipGitChecks: z.boolean().optional(),
				}),
			)
			.query(async ({ input }) => {
				const worktree = getWorktree(input.worktreeId);

				if (!worktree) {
					return {
						canDelete: false,
						reason: "Worktree not found",
						worktree: null,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				const repository = getRepository(worktree.repositoryId);

				if (!repository) {
					return {
						canDelete: false,
						reason: "Repository not found",
						worktree,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				if (input.skipGitChecks) {
					return {
						canDelete: true,
						reason: null,
						worktree,
						warning: null,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}

				try {
					const exists = await worktreeExists(repository.mainRepoPath, worktree.path);

					if (!exists) {
						return {
							canDelete: true,
							reason: null,
							worktree,
							warning: "Worktree not found in git (may have been manually removed)",
							hasChanges: false,
							hasUnpushedCommits: false,
						};
					}

					const [hasChanges, unpushedCommits] = await Promise.all([
						hasUncommittedChanges(worktree.path),
						hasUnpushedCommits(worktree.path),
					]);

					return {
						canDelete: true,
						reason: null,
						worktree,
						warning: null,
						hasChanges,
						hasUnpushedCommits: unpushedCommits,
					};
				} catch (error) {
					return {
						canDelete: false,
						reason: `Failed to check worktree status: ${error instanceof Error ? error.message : String(error)}`,
						worktree,
						hasChanges: false,
						hasUnpushedCommits: false,
					};
				}
			}),

		// Delete a closed worktree (no active node) by worktree ID
		deleteWorktree: publicProcedure
			.input(z.object({ worktreeId: z.string() }))
			.mutation(async ({ input }) => {
				const worktree = getWorktree(input.worktreeId);

				if (!worktree) {
					return { success: false, error: "Worktree not found" };
				}

				const repository = getRepository(worktree.repositoryId);

				if (!repository) {
					return { success: false, error: "Repository not found" };
				}

				// Acquire repository lock to prevent racing with concurrent operations
				await nodeInitManager.acquireRepositoryLock(repository.id);

				try {
					const exists = await worktreeExists(repository.mainRepoPath, worktree.path);

					if (exists) {
						const teardownResult = await runTeardown(
							repository.mainRepoPath,
							worktree.path,
							worktree.branch,
						);
						if (!teardownResult.success) {
							console.error(
								`Teardown failed for worktree ${worktree.branch}:`,
								teardownResult.error,
							);
						}
					}

					try {
						if (exists) {
							await removeWorktree(repository.mainRepoPath, worktree.path);
						} else {
							console.warn(`Worktree ${worktree.path} not found in git, skipping removal`);
						}
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Failed to remove worktree:", errorMessage);
						return {
							success: false,
							error: `Failed to remove worktree: ${errorMessage}`,
						};
					}
				} finally {
					nodeInitManager.releaseRepositoryLock(repository.id);
				}

				deleteWorktreeRecord(input.worktreeId);
				invalidateWorktreePathCache();
				hideRepositoryIfNoNodes(worktree.repositoryId);

				track("worktree_deleted", { worktree_id: input.worktreeId });

				return { success: true };
			}),
	});
};
