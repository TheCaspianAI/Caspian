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
 * Determines the status of a branch name as the user types in the NewNodeModal.
 *
 * Cross-references the debounced branch preview against existing branches and
 * Caspian worktrees to return one of four states: available, has-active-node,
 * has-orphaned-worktree, or exists-no-worktree. The lookup is debounced at 300ms
 * and runs entirely in-memory against data from existing tRPC queries.
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
