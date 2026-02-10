import { useEffect, useMemo, useState } from "react";

export interface BranchStatus {
	status: "available" | "has-active-node" | "has-orphaned-worktree" | "exists-no-worktree";
	nodeId?: string;
	worktreeId?: string;
	branchName?: string;
}

const AVAILABLE: BranchStatus = { status: "available" };
const DEBOUNCE_MS = 300;

interface UseBranchStatusParams {
	branchPreview: string;
	repositoryId: string | null;
	branches: Array<{ name: string; isLocal: boolean; isRemote: boolean }> | undefined;
	worktrees: Array<{
		branch: string;
		hasActiveNode: boolean;
		node: { id: string } | null;
		id: string;
	}>;
}

/**
 * Determine the status of a branch preview against the repository's branches and worktrees, debouncing the preview input to avoid rapid updates.
 *
 * @returns The resolved `BranchStatus`: `AVAILABLE` when the preview does not match any branch or required inputs are missing; `{ status: "exists-no-worktree", branchName }` when a matching branch exists with no worktree; `{ status: "has-orphaned-worktree", worktreeId }` when a matching worktree exists but has no active node; or `{ status: "has-active-node", nodeId }` when a matching worktree is attached to an active node.
 */
export function useBranchStatus({
	branchPreview,
	repositoryId,
	branches,
	worktrees,
}: UseBranchStatusParams): BranchStatus {
	const [debouncedPreview, setDebouncedPreview] = useState(branchPreview);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedPreview(branchPreview), DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [branchPreview]);

	return useMemo(() => {
		if (!debouncedPreview || !repositoryId || !branches) {
			return AVAILABLE;
		}

		const previewLower = debouncedPreview.toLowerCase();
		const matchedBranch = branches.find((b) => b.name.toLowerCase() === previewLower);

		if (!matchedBranch) {
			return AVAILABLE;
		}

		const matchedWorktree = worktrees.find((wt) => wt.branch.toLowerCase() === previewLower);

		if (matchedWorktree?.hasActiveNode && matchedWorktree.node) {
			return { status: "has-active-node", nodeId: matchedWorktree.node.id };
		}

		if (matchedWorktree && !matchedWorktree.hasActiveNode) {
			return { status: "has-orphaned-worktree", worktreeId: matchedWorktree.id };
		}

		return { status: "exists-no-worktree", branchName: matchedBranch.name };
	}, [debouncedPreview, repositoryId, branches, worktrees]);
}