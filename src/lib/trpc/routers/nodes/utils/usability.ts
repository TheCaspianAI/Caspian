import { existsSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { nodeInitManager } from "main/lib/node-init-manager";
import type { NodeInitProgress } from "shared/types/node-init";

export type NodeUsabilityReason = "initializing" | "failed" | "path_missing" | "not_found";

export interface NodeUsabilityCheck {
	usable: boolean;
	reason?: NodeUsabilityReason;
	progress?: NodeInitProgress;
}

/**
 * Check if a node is usable for operations requiring the worktree path.
 * Returns detailed status for UI to display appropriate state.
 *
 * A node is NOT usable if:
 * - It is currently initializing (git operations in progress)
 * - Its initialization failed (needs retry or delete)
 * - The worktree path doesn't exist on disk
 */
export function checkNodeUsability(
	nodeId: string,
	worktreePath: string | null | undefined,
): NodeUsabilityCheck {
	if (nodeInitManager.isInitializing(nodeId)) {
		return {
			usable: false,
			reason: "initializing",
			progress: nodeInitManager.getProgress(nodeId),
		};
	}

	if (nodeInitManager.hasFailed(nodeId)) {
		return {
			usable: false,
			reason: "failed",
			progress: nodeInitManager.getProgress(nodeId),
		};
	}

	if (!worktreePath) {
		return { usable: false, reason: "path_missing" };
	}

	if (!existsSync(worktreePath)) {
		return { usable: false, reason: "path_missing" };
	}

	return { usable: true };
}

/**
 * Throws TRPCError if node is not usable.
 * Use this as a guard in tRPC procedures that require the worktree to exist.
 *
 * The error includes a `cause` object with details that the frontend can use
 * to display appropriate UI (e.g., progress view for initializing, error for failed).
 */
export function assertNodeUsable(nodeId: string, worktreePath: string | null | undefined): void {
	const check = checkNodeUsability(nodeId, worktreePath);

	if (!check.usable) {
		switch (check.reason) {
			case "initializing":
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Node is still initializing",
					cause: { reason: "initializing", progress: check.progress },
				});
			case "failed":
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Node initialization failed",
					cause: { reason: "failed", progress: check.progress },
				});
			case "path_missing":
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Node path does not exist",
					cause: { reason: "path_missing" },
				});
			default:
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Node is not usable",
				});
		}
	}
}

/**
 * Check if a node usability error indicates the node is initializing.
 * Useful for frontend to determine whether to show progress UI.
 */
export function isInitializingError(error: unknown): boolean {
	if (error instanceof TRPCError) {
		const cause = error.cause as { reason?: string } | undefined;
		return cause?.reason === "initializing";
	}
	return false;
}

/**
 * Check if a node usability error indicates the node failed to initialize.
 * Useful for frontend to determine whether to show error UI with retry option.
 */
export function isFailedError(error: unknown): boolean {
	if (error instanceof TRPCError) {
		const cause = error.cause as { reason?: string } | undefined;
		return cause?.reason === "failed";
	}
	return false;
}
