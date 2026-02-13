import { eq } from "drizzle-orm";
import { repositories, worktrees } from "lib/local-db";
import { track } from "main/lib/analytics";
import { localDb } from "main/lib/local-db";
import { nodeInitManager } from "main/lib/node-init-manager";
import {
	branchExistsOnRemote,
	createWorktree,
	createWorktreeFromExistingBranch,
	fetchDefaultBranch,
	hasOriginRemote,
	initializeEmptyRepo,
	isRemoteEmpty,
	refExistsLocally,
	refreshDefaultBranch,
	removeWorktree,
	sanitizeGitError,
} from "./git";
import { copyCaspianConfigToWorktree } from "./setup";

export interface NodeInitParams {
	nodeId: string;
	repositoryId: string;
	worktreeId: string;
	worktreePath: string;
	branch: string;
	baseBranch: string;
	/** If true, user explicitly specified baseBranch - don't auto-update it */
	baseBranchWasExplicit: boolean;
	mainRepoPath: string;
	/** If true, use an existing branch instead of creating a new one */
	useExistingBranch?: boolean;
	/** If true, skip worktree creation (worktree already exists on disk) */
	skipWorktreeCreation?: boolean;
}

/**
 * Background initialization for node worktree.
 * This runs after the fast-path mutation returns, streaming progress to the renderer.
 *
 * Does NOT throw - errors are communicated via progress events.
 */
export async function initializeNodeWorktree({
	nodeId,
	repositoryId,
	worktreeId,
	worktreePath,
	branch,
	baseBranch,
	baseBranchWasExplicit,
	mainRepoPath,
	useExistingBranch,
	skipWorktreeCreation,
}: NodeInitParams): Promise<void> {
	const manager = nodeInitManager;

	try {
		// Acquire per-repository lock to prevent concurrent git operations
		await manager.acquireRepositoryLock(repositoryId);

		// Check cancellation before starting (use durable cancellation check)
		// Note: We don't emit "failed" progress for cancellations because the node
		// is being deleted. Emitting would trigger a refetch race condition where the
		// node temporarily reappears. finalizeJob() in the finally block will
		// still unblock waitForInit() callers.
		if (manager.isCancellationRequested(nodeId)) {
			return;
		}

		if (useExistingBranch) {
			if (skipWorktreeCreation) {
				manager.markWorktreeCreated(nodeId);
			} else {
				manager.updateProgress(nodeId, "creating_worktree", "Creating git worktree...");
				await createWorktreeFromExistingBranch({
					mainRepoPath,
					branch,
					worktreePath,
				});
				manager.markWorktreeCreated(nodeId);
			}

			if (manager.isCancellationRequested(nodeId)) {
				try {
					await removeWorktree(mainRepoPath, worktreePath);
				} catch (e) {
					console.error("[node-init] Failed to cleanup worktree after cancel:", e);
				}
				return;
			}

			manager.updateProgress(nodeId, "copying_config", "Copying configuration...");
			copyCaspianConfigToWorktree(mainRepoPath, worktreePath);

			if (manager.isCancellationRequested(nodeId)) {
				try {
					await removeWorktree(mainRepoPath, worktreePath);
				} catch (e) {
					console.error("[node-init] Failed to cleanup worktree after cancel:", e);
				}
				return;
			}

			manager.updateProgress(nodeId, "finalizing", "Finalizing setup...");
			localDb
				.update(worktrees)
				.set({
					gitStatus: {
						branch,
						needsRebase: false,
						lastRefreshed: Date.now(),
					},
				})
				.where(eq(worktrees.id, worktreeId))
				.run();

			manager.updateProgress(nodeId, "ready", "Ready");

			track("node_initialized", {
				node_id: nodeId,
				repository_id: repositoryId,
				branch,
				base_branch: branch, // For existing branch, base = branch
				use_existing_branch: true,
			});

			return;
		}

		manager.updateProgress(nodeId, "syncing", "Syncing with remote...");
		const remoteDefaultBranch = await refreshDefaultBranch(mainRepoPath);

		let effectiveBaseBranch = baseBranch;

		if (remoteDefaultBranch) {
			const repository = localDb
				.select()
				.from(repositories)
				.where(eq(repositories.id, repositoryId))
				.get();
			if (repository && remoteDefaultBranch !== repository.defaultBranch) {
				localDb
					.update(repositories)
					.set({ defaultBranch: remoteDefaultBranch })
					.where(eq(repositories.id, repositoryId))
					.run();
			}

			// If baseBranch was auto-derived and differs from remote,
			// update the worktree record so retries use the correct branch
			if (!baseBranchWasExplicit && remoteDefaultBranch !== baseBranch) {
				console.log(
					`[node-init] Auto-updating baseBranch from "${baseBranch}" to "${remoteDefaultBranch}" for node ${nodeId}`,
				);
				effectiveBaseBranch = remoteDefaultBranch;
				localDb
					.update(worktrees)
					.set({ baseBranch: remoteDefaultBranch })
					.where(eq(worktrees.id, worktreeId))
					.run();
			}
		}

		if (manager.isCancellationRequested(nodeId)) {
			return;
		}

		manager.updateProgress(nodeId, "verifying", "Verifying base branch...");
		const hasRemote = await hasOriginRemote(mainRepoPath);

		type LocalStartPointResult = {
			ref: string;
			fallbackBranch?: string;
		} | null;

		const resolveLocalStartPoint = async (
			reason: string,
			checkOriginRefs: boolean,
		): Promise<LocalStartPointResult> => {
			// Try origin tracking ref first (only if remote exists)
			if (checkOriginRefs) {
				const originRef = `origin/${effectiveBaseBranch}`;
				if (await refExistsLocally(mainRepoPath, originRef)) {
					console.log(`[node-init] ${reason}. Using local tracking ref: ${originRef}`);
					return { ref: originRef };
				}
			}

			// Try local branch
			if (await refExistsLocally(mainRepoPath, effectiveBaseBranch)) {
				console.log(`[node-init] ${reason}. Using local branch: ${effectiveBaseBranch}`);
				return { ref: effectiveBaseBranch };
			}

			// Only try fallback branches if the base branch was auto-derived
			if (baseBranchWasExplicit) {
				console.log(
					`[node-init] ${reason}. Base branch "${effectiveBaseBranch}" was explicitly set, not using fallback.`,
				);
				return null;
			}

			// Fallback: try common default branch names
			const commonBranches = ["main", "master", "develop", "trunk"];
			for (const branch of commonBranches) {
				if (branch === effectiveBaseBranch) continue; // Already tried
				// Only check origin refs if remote exists
				if (checkOriginRefs) {
					const fallbackOriginRef = `origin/${branch}`;
					if (await refExistsLocally(mainRepoPath, fallbackOriginRef)) {
						console.log(`[node-init] ${reason}. Using fallback tracking ref: ${fallbackOriginRef}`);
						return { ref: fallbackOriginRef, fallbackBranch: branch };
					}
				}
				if (await refExistsLocally(mainRepoPath, branch)) {
					console.log(`[node-init] ${reason}. Using fallback local branch: ${branch}`);
					return { ref: branch, fallbackBranch: branch };
				}
			}

			return null;
		};

		// Helper to update baseBranch when fallback is used
		const applyFallbackBranch = (fallbackBranch: string) => {
			console.log(
				`[node-init] Updating baseBranch from "${effectiveBaseBranch}" to "${fallbackBranch}" for node ${nodeId}`,
			);
			effectiveBaseBranch = fallbackBranch;
			localDb
				.update(worktrees)
				.set({ baseBranch: fallbackBranch })
				.where(eq(worktrees.id, worktreeId))
				.run();
		};

		let startPoint: string;
		if (hasRemote) {
			const branchCheck = await branchExistsOnRemote({
				worktreePath: mainRepoPath,
				branchName: effectiveBaseBranch,
			});

			if (branchCheck.status === "error") {
				const sanitizedError = sanitizeGitError(branchCheck.message);
				console.warn(
					`[node-init] Cannot verify remote branch: ${sanitizedError}. Falling back to local ref.`,
				);

				manager.updateProgress(
					nodeId,
					"verifying",
					"Using local reference (remote unavailable)",
					sanitizedError,
				);

				const localResult = await resolveLocalStartPoint("Remote unavailable", true);
				if (!localResult) {
					manager.updateProgress(
						nodeId,
						"failed",
						"No local reference available",
						baseBranchWasExplicit
							? `Cannot reach remote and branch "${effectiveBaseBranch}" doesn't exist locally. Please check your network connection and try again.`
							: `Cannot reach remote and no local ref for "${effectiveBaseBranch}" exists. Please check your network connection and try again.`,
					);
					return;
				}
				if (localResult.fallbackBranch) {
					applyFallbackBranch(localResult.fallbackBranch);
					manager.updateProgress(
						nodeId,
						"verifying",
						`Using "${localResult.fallbackBranch}" branch`,
						`Branch "${baseBranch}" not found locally. Using "${localResult.fallbackBranch}" instead.`,
					);
				}
				startPoint = localResult.ref;
			} else if (branchCheck.status === "not_found") {
				// Branch doesn't exist on remote - check if this is an empty repo or try fallbacks
				console.log(
					`[node-init] Branch "${effectiveBaseBranch}" not found on remote. Checking for alternatives...`,
				);

				// Check if the remote is completely empty (no branches at all)
				const remoteEmpty = await isRemoteEmpty(mainRepoPath);

				if (remoteEmpty === true) {
					// Empty repo - create initial commit and push
					console.log(
						`[node-init] Remote is empty. Initializing with first commit on "${effectiveBaseBranch}"...`,
					);
					manager.updateProgress(
						nodeId,
						"verifying",
						"Initializing empty repository...",
						`Remote has no branches. Creating initial commit on "${effectiveBaseBranch}".`,
					);

					try {
						await initializeEmptyRepo(mainRepoPath, effectiveBaseBranch);
						console.log(
							`[node-init] Successfully initialized empty repo with branch "${effectiveBaseBranch}"`,
						);
						startPoint = `origin/${effectiveBaseBranch}`;
					} catch (initError) {
						const errorMsg = initError instanceof Error ? initError.message : String(initError);
						console.error(`[node-init] Failed to initialize empty repo: ${errorMsg}`);
						manager.updateProgress(
							nodeId,
							"failed",
							"Failed to initialize repository",
							`Could not create initial commit: ${errorMsg}`,
						);
						return;
					}
				} else if (!baseBranchWasExplicit) {
					// Remote has branches but not the one we want - try fallbacks
					const localResult = await resolveLocalStartPoint("Branch not found on remote", true);

					if (localResult) {
						if (localResult.fallbackBranch) {
							applyFallbackBranch(localResult.fallbackBranch);
							manager.updateProgress(
								nodeId,
								"verifying",
								`Using "${localResult.fallbackBranch}" branch`,
								`Branch "${baseBranch}" not found on remote. Using "${localResult.fallbackBranch}" instead.`,
							);
						}
						startPoint = localResult.ref;
					} else {
						manager.updateProgress(
							nodeId,
							"failed",
							"Branch does not exist",
							`Branch "${effectiveBaseBranch}" does not exist on origin and no fallback branches found.`,
						);
						return;
					}
				} else {
					// User explicitly specified a branch that doesn't exist
					manager.updateProgress(
						nodeId,
						"failed",
						"Branch does not exist on remote",
						`Branch "${effectiveBaseBranch}" does not exist on origin. Please delete this node and try again with a different base branch.`,
					);
					return;
				}
			} else {
				startPoint = `origin/${effectiveBaseBranch}`;
			}
		} else {
			const localResult = await resolveLocalStartPoint("No remote configured", false);
			if (!localResult) {
				manager.updateProgress(
					nodeId,
					"failed",
					"No local reference available",
					baseBranchWasExplicit
						? `No remote configured and branch "${effectiveBaseBranch}" doesn't exist locally.`
						: `No remote configured and no local ref for "${effectiveBaseBranch}" exists.`,
				);
				return;
			}
			if (localResult.fallbackBranch) {
				applyFallbackBranch(localResult.fallbackBranch);
				manager.updateProgress(
					nodeId,
					"verifying",
					`Using "${localResult.fallbackBranch}" branch`,
					`Branch "${baseBranch}" not found locally. Using "${localResult.fallbackBranch}" instead.`,
				);
			}
			startPoint = localResult.ref;
		}

		if (manager.isCancellationRequested(nodeId)) {
			return;
		}

		manager.updateProgress(nodeId, "fetching", "Fetching latest changes...");
		if (hasRemote) {
			try {
				await fetchDefaultBranch(mainRepoPath, effectiveBaseBranch);
			} catch (fetchError) {
				// Fetch failed - verify local tracking ref exists before proceeding
				const originRef = `origin/${effectiveBaseBranch}`;
				if (!(await refExistsLocally(mainRepoPath, originRef))) {
					console.warn(
						`[node-init] Fetch failed and local ref "${originRef}" doesn't exist. Attempting local fallback.`,
					);
					const localResult = await resolveLocalStartPoint(
						"Fetch failed and remote tracking ref unavailable",
						true,
					);
					if (!localResult) {
						const sanitizedError = sanitizeGitError(
							fetchError instanceof Error ? fetchError.message : String(fetchError),
						);
						manager.updateProgress(
							nodeId,
							"failed",
							"Cannot fetch branch",
							baseBranchWasExplicit
								? `Failed to fetch "${effectiveBaseBranch}" and it doesn't exist locally. ` +
										`Please check your network connection or try running "git fetch origin ${effectiveBaseBranch}" manually. ` +
										`Error: ${sanitizedError}`
								: `Failed to fetch "${effectiveBaseBranch}" and no local reference exists. ` +
										`Please check your network connection or try running "git fetch origin ${effectiveBaseBranch}" manually. ` +
										`Error: ${sanitizedError}`,
						);
						return;
					}
					if (localResult.fallbackBranch) {
						applyFallbackBranch(localResult.fallbackBranch);
						manager.updateProgress(
							nodeId,
							"fetching",
							`Using "${localResult.fallbackBranch}" branch`,
							`Could not fetch "${baseBranch}". Using local "${localResult.fallbackBranch}" branch instead.`,
						);
					}
					startPoint = localResult.ref;
				}
			}
		}

		if (manager.isCancellationRequested(nodeId)) {
			return;
		}

		manager.updateProgress(nodeId, "creating_worktree", "Creating git worktree...");
		await createWorktree(mainRepoPath, branch, worktreePath, startPoint);
		manager.markWorktreeCreated(nodeId);

		if (manager.isCancellationRequested(nodeId)) {
			try {
				await removeWorktree(mainRepoPath, worktreePath);
			} catch (e) {
				console.error("[node-init] Failed to cleanup worktree after cancel:", e);
			}
			return;
		}

		manager.updateProgress(nodeId, "copying_config", "Copying configuration...");
		copyCaspianConfigToWorktree(mainRepoPath, worktreePath);

		if (manager.isCancellationRequested(nodeId)) {
			try {
				await removeWorktree(mainRepoPath, worktreePath);
			} catch (e) {
				console.error("[node-init] Failed to cleanup worktree after cancel:", e);
			}
			return;
		}

		manager.updateProgress(nodeId, "finalizing", "Finalizing setup...");

		localDb
			.update(worktrees)
			.set({
				gitStatus: {
					branch,
					needsRebase: false,
					lastRefreshed: Date.now(),
				},
			})
			.where(eq(worktrees.id, worktreeId))
			.run();

		manager.updateProgress(nodeId, "ready", "Ready");

		track("node_initialized", {
			node_id: nodeId,
			repository_id: repositoryId,
			branch,
			base_branch: effectiveBaseBranch,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[node-init] Failed to initialize ${nodeId}:`, errorMessage);

		if (manager.wasWorktreeCreated(nodeId)) {
			try {
				await removeWorktree(mainRepoPath, worktreePath);
				console.log(`[node-init] Cleaned up partial worktree at ${worktreePath}`);
			} catch (cleanupError) {
				console.error("[node-init] Failed to cleanup partial worktree:", cleanupError);
			}
		}

		manager.updateProgress(nodeId, "failed", "Initialization failed", errorMessage);
	} finally {
		// Always finalize the job to unblock waitForInit() callers (e.g., delete mutation)
		manager.finalizeJob(nodeId);
		manager.releaseRepositoryLock(repositoryId);
	}
}
