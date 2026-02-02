import { repositories, type SelectNode, worktrees } from "lib/local-db";
import { eq } from "drizzle-orm";
import { localDb } from "main/lib/local-db";

/**
 * Gets the worktree path for a node by worktreeId
 */
export function getWorktreePath(worktreeId: string): string | undefined {
	const worktree = localDb
		.select()
		.from(worktrees)
		.where(eq(worktrees.id, worktreeId))
		.get();
	return worktree?.path;
}

/**
 * Gets the working directory path for a node.
 * For worktree nodes: returns the worktree path
 * For branch nodes: returns the main repo path
 */
export function getNodePath(node: SelectNode): string | null {
	if (node.type === "branch") {
		const repository = localDb
			.select()
			.from(repositories)
			.where(eq(repositories.id, node.repositoryId))
			.get();
		return repository?.mainRepoPath ?? null;
	}

	// For worktree type, use worktree path
	if (node.worktreeId) {
		const worktree = localDb
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, node.worktreeId))
			.get();
		return worktree?.path ?? null;
	}

	return null;
}
