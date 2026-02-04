import { EventEmitter } from "node:events";
import type { NodeInitProgress, NodeInitStep } from "shared/types/node-init";

interface InitJob {
	nodeId: string;
	repositoryId: string;
	progress: NodeInitProgress;
	cancelled: boolean;
	worktreeCreated: boolean; // Track for cleanup on failure
}

/**
 * Manages node initialization jobs with:
 * - Progress tracking and streaming via EventEmitter
 * - Cancellation support
 * - Per-repository mutex to prevent concurrent git operations
 *
 * This is an in-memory manager - state is NOT persisted across app restarts.
 * If the app restarts during initialization, the node may be left in
 * an incomplete state requiring manual cleanup (documented limitation).
 */
class NodeInitManager extends EventEmitter {
	private jobs = new Map<string, InitJob>();
	private repositoryLocks = new Map<string, Promise<void>>();
	private repositoryLockResolvers = new Map<string, () => void>();

	// Coordination state that persists even after job progress is cleared
	private donePromises = new Map<string, Promise<void>>();
	private doneResolvers = new Map<string, () => void>();
	private cancellations = new Set<string>();

	/**
	 * Check if a node is currently initializing
	 */
	isInitializing(nodeId: string): boolean {
		const job = this.jobs.get(nodeId);
		return job !== undefined && job.progress.step !== "ready" && job.progress.step !== "failed";
	}

	/**
	 * Check if a node has failed initialization
	 */
	hasFailed(nodeId: string): boolean {
		const job = this.jobs.get(nodeId);
		return job?.progress.step === "failed";
	}

	/**
	 * Get current progress for a node
	 */
	getProgress(nodeId: string): NodeInitProgress | undefined {
		return this.jobs.get(nodeId)?.progress;
	}

	/**
	 * Get all nodes currently initializing or failed
	 */
	getAllProgress(): NodeInitProgress[] {
		return Array.from(this.jobs.values()).map((job) => job.progress);
	}

	/**
	 * Start tracking a new initialization job
	 */
	startJob(nodeId: string, repositoryId: string): void {
		if (this.jobs.has(nodeId)) {
			console.warn(`[node-init] Job already exists for ${nodeId}, clearing old job`);
			this.jobs.delete(nodeId);
		}

		// Clear any stale cancellation state from previous attempt
		this.cancellations.delete(nodeId);

		// Create done promise for coordination (allows delete to wait for init completion)
		let resolve: () => void;
		const promise = new Promise<void>((r) => {
			resolve = r;
		});
		this.donePromises.set(nodeId, promise);
		this.doneResolvers.set(nodeId, resolve!);

		const progress: NodeInitProgress = {
			nodeId,
			repositoryId,
			step: "pending",
			message: "Preparing...",
		};

		this.jobs.set(nodeId, {
			nodeId,
			repositoryId,
			progress,
			cancelled: false,
			worktreeCreated: false,
		});

		this.emit("progress", progress);
	}

	/**
	 * Update progress for an initialization job
	 */
	updateProgress(nodeId: string, step: NodeInitStep, message: string, error?: string): void {
		const job = this.jobs.get(nodeId);
		if (!job) {
			console.warn(`[node-init] No job found for ${nodeId}`);
			return;
		}

		job.progress = {
			...job.progress,
			step,
			message,
			error,
		};

		this.emit("progress", job.progress);

		// Clean up ready jobs after a delay
		if (step === "ready") {
			const timer = setTimeout(() => {
				if (this.jobs.get(nodeId)?.progress.step === "ready") {
					this.jobs.delete(nodeId);
				}
			}, 2000);
			timer.unref();
		}
	}

	/**
	 * Mark that the worktree has been created (for cleanup tracking)
	 */
	markWorktreeCreated(nodeId: string): void {
		const job = this.jobs.get(nodeId);
		if (job) {
			job.worktreeCreated = true;
		}
	}

	/**
	 * Check if worktree was created (for cleanup decisions)
	 */
	wasWorktreeCreated(nodeId: string): boolean {
		return this.jobs.get(nodeId)?.worktreeCreated ?? false;
	}

	/**
	 * Cancel an initialization job.
	 * Sets cancellation flag on job (if exists) AND adds to cancellations Set.
	 * The Set persists even after job is cleared, preventing the race where
	 * clearJob() removes the cancellation signal before init can observe it.
	 */
	cancel(nodeId: string): void {
		// Add to durable cancellations set (survives clearJob)
		this.cancellations.add(nodeId);

		const job = this.jobs.get(nodeId);
		if (job) {
			job.cancelled = true;
		}
		console.log(`[node-init] Cancelled job for ${nodeId}`);
	}

	/**
	 * Check if a job has been cancelled (legacy - checks job record only).
	 * @deprecated Use isCancellationRequested() for race-safe cancellation checks.
	 */
	isCancelled(nodeId: string): boolean {
		return this.jobs.get(nodeId)?.cancelled ?? false;
	}

	/**
	 * Check if cancellation has been requested for a node.
	 * This checks the durable cancellations Set, which persists even after
	 * the job record is cleared. Use this in init flow for race-safe checks.
	 */
	isCancellationRequested(nodeId: string): boolean {
		return this.cancellations.has(nodeId);
	}

	/**
	 * Clear a job (called before retry or after delete).
	 * Also cleans up coordination state (done promise, cancellation).
	 */
	clearJob(nodeId: string): void {
		this.jobs.delete(nodeId);
		this.donePromises.delete(nodeId);
		this.doneResolvers.delete(nodeId);
		this.cancellations.delete(nodeId);
	}

	/**
	 * Finalize a job, resolving the done promise and cleaning up coordination state.
	 * MUST be called in all init exit paths (success, failure, cancellation).
	 * This allows waitForInit() to unblock.
	 */
	finalizeJob(nodeId: string): void {
		const resolve = this.doneResolvers.get(nodeId);
		if (resolve) {
			resolve();
			console.log(`[node-init] Finalized job for ${nodeId}`);
		}

		// Clean up coordination state to prevent memory leaks
		// This is safe because waitForInit() either:
		// 1. Already resolved (promise completed)
		// 2. Will return immediately (promise no longer in map)
		this.donePromises.delete(nodeId);
		this.doneResolvers.delete(nodeId);
		// Note: Don't clear cancellations here - clearJob handles that
		// to allow cancellation signal to persist through async cleanup
	}

	/**
	 * Wait for an init job to complete (success, failure, or cancellation).
	 * Returns immediately if no init is in progress.
	 *
	 * @param nodeId - The node to wait for
	 * @param timeoutMs - Maximum time to wait (default 30s). On timeout, returns without error.
	 */
	async waitForInit(nodeId: string, timeoutMs = 30000): Promise<void> {
		const promise = this.donePromises.get(nodeId);
		if (!promise) {
			// No init in progress or already completed
			return;
		}

		console.log(`[node-init] Waiting for init to complete: ${nodeId}`);

		await Promise.race([
			promise,
			new Promise<void>((resolve) => {
				setTimeout(() => {
					console.warn(`[node-init] Wait timed out after ${timeoutMs}ms for ${nodeId}`);
					resolve();
				}, timeoutMs);
			}),
		]);
	}

	/**
	 * Acquire per-repository lock for git operations.
	 * Only one git operation per repository at a time.
	 * This prevents race conditions and git lock conflicts.
	 */
	async acquireRepositoryLock(repositoryId: string): Promise<void> {
		// Wait for any existing lock to be released
		while (this.repositoryLocks.has(repositoryId)) {
			await this.repositoryLocks.get(repositoryId);
		}

		// Create a new lock
		let resolve: () => void;
		const promise = new Promise<void>((r) => {
			resolve = r;
		});

		this.repositoryLocks.set(repositoryId, promise);
		this.repositoryLockResolvers.set(repositoryId, resolve!);
	}

	/**
	 * Release per-repository lock
	 */
	releaseRepositoryLock(repositoryId: string): void {
		const resolve = this.repositoryLockResolvers.get(repositoryId);
		if (resolve) {
			this.repositoryLocks.delete(repositoryId);
			this.repositoryLockResolvers.delete(repositoryId);
			resolve();
		}
	}

	/**
	 * Check if a repository has an active lock
	 */
	hasRepositoryLock(repositoryId: string): boolean {
		return this.repositoryLocks.has(repositoryId);
	}
}

/** Singleton node initialization manager instance */
export const nodeInitManager = new NodeInitManager();
