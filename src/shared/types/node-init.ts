/**
 * Node initialization progress types.
 * Used for streaming progress updates during node creation.
 */

export type NodeInitStep =
	| "pending"
	| "syncing" // Syncing with remote
	| "verifying" // Verifying base branch exists
	| "fetching" // Fetching latest changes
	| "creating_worktree" // Creating git worktree
	| "copying_config" // Copying .caspian configuration
	| "finalizing" // Final DB operations
	| "ready"
	| "failed";

export interface NodeInitProgress {
	nodeId: string;
	repositoryId: string;
	step: NodeInitStep;
	message: string;
	error?: string;
}

export const INIT_STEP_MESSAGES: Record<NodeInitStep, string> = {
	pending: "Preparing...",
	syncing: "Syncing with remote...",
	verifying: "Verifying base branch...",
	fetching: "Fetching latest changes...",
	creating_worktree: "Creating git worktree...",
	copying_config: "Copying configuration...",
	finalizing: "Finalizing setup...",
	ready: "Ready",
	failed: "Failed",
};

/**
 * Order of steps for UI progress display.
 * Used to show completed/current/pending steps in the progress view.
 */
export const INIT_STEP_ORDER: NodeInitStep[] = [
	"pending",
	"syncing",
	"verifying",
	"fetching",
	"creating_worktree",
	"copying_config",
	"finalizing",
	"ready",
];

/**
 * Get the index of a step in the progress order.
 * Returns -1 for "failed" since it's not part of the normal flow.
 */
export function getStepIndex(step: NodeInitStep): number {
	if (step === "failed") return -1;
	return INIT_STEP_ORDER.indexOf(step);
}

/**
 * Check if a step is complete based on the current step.
 */
export function isStepComplete(
	step: NodeInitStep,
	currentStep: NodeInitStep,
): boolean {
	if (currentStep === "failed") return false;
	const stepIndex = getStepIndex(step);
	const currentIndex = getStepIndex(currentStep);
	return stepIndex < currentIndex;
}
