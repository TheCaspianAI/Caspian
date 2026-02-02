import {
	repositories,
	type SelectRepository,
	type SelectNode,
	type SelectWorktree,
	settings,
	nodes,
	worktrees,
} from "lib/local-db";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { localDb } from "main/lib/local-db";

/**
 * Set the last active node in settings.
 * Uses upsert to handle both initial and subsequent calls.
 */
export function setLastActiveNode(nodeId: string | null): void {
	localDb
		.insert(settings)
		.values({ id: 1, lastActiveNodeId: nodeId })
		.onConflictDoUpdate({
			target: settings.id,
			set: { lastActiveNodeId: nodeId },
		})
		.run();
}

/**
 * Get the maximum tab order for nodes in a repository (excluding those being deleted).
 * Returns -1 if no nodes exist.
 */
export function getMaxNodeTabOrder(repositoryId: string): number {
	const repositoryNodes = localDb
		.select()
		.from(nodes)
		.where(
			and(eq(nodes.repositoryId, repositoryId), isNull(nodes.deletingAt)),
		)
		.all();
	return repositoryNodes.length > 0
		? Math.max(...repositoryNodes.map((n) => n.tabOrder))
		: -1;
}

/**
 * Get the maximum tab order for active repositories.
 * Returns -1 if no active repositories exist.
 */
export function getMaxRepositoryTabOrder(): number {
	const activeRepositories = localDb
		.select()
		.from(repositories)
		.where(isNotNull(repositories.tabOrder))
		.all();
	return activeRepositories.length > 0
		? Math.max(...activeRepositories.map((r) => r.tabOrder ?? 0))
		: -1;
}

/**
 * Update repository's lastOpenedAt and tabOrder (if not already set).
 * This is called when opening or creating a node to ensure the repository
 * appears in the active repositories list.
 */
export function activateRepository(repository: SelectRepository): void {
	const maxRepositoryTabOrder = getMaxRepositoryTabOrder();
	localDb
		.update(repositories)
		.set({
			lastOpenedAt: Date.now(),
			tabOrder:
				repository.tabOrder === null ? maxRepositoryTabOrder + 1 : repository.tabOrder,
		})
		.where(eq(repositories.id, repository.id))
		.run();
}

/**
 * Hide a repository from the sidebar by setting tabOrder to null.
 * Called when the last node in a repository is deleted/closed.
 */
export function hideRepository(repositoryId: string): void {
	localDb
		.update(repositories)
		.set({ tabOrder: null })
		.where(eq(repositories.id, repositoryId))
		.run();
}

/**
 * Check if a repository has any remaining nodes.
 * If not, hide it from the sidebar.
 *
 * Note: We check for ANY nodes (including those being deleted) to avoid
 * prematurely hiding the repository when multiple nodes are being deleted
 * concurrently. The repository should only be hidden when all deletions complete.
 */
export function hideRepositoryIfNoNodes(repositoryId: string): void {
	const remainingNodes = localDb
		.select()
		.from(nodes)
		.where(eq(nodes.repositoryId, repositoryId))
		.all();
	if (remainingNodes.length === 0) {
		hideRepository(repositoryId);
	}
}

/**
 * Select the next active node after the current one is removed.
 * Returns the ID of the next node to activate, or null if none.
 * Selects the most recently opened node from VISIBLE repositories only
 * (repositories with tabOrder != null). This ensures the selected node
 * will appear in the sidebar and can be properly displayed by the frontend.
 */
export function selectNextActiveNode(): string | null {
	const sorted = localDb
		.select({ id: nodes.id, lastOpenedAt: nodes.lastOpenedAt })
		.from(nodes)
		.innerJoin(repositories, eq(nodes.repositoryId, repositories.id))
		.where(
			and(
				isNull(nodes.deletingAt),
				isNotNull(repositories.tabOrder), // Only visible repositories
			),
		)
		.orderBy(desc(nodes.lastOpenedAt))
		.all();
	return sorted[0]?.id ?? null;
}

/**
 * Update settings to point to the next active node if the current
 * active node was removed.
 */
export function updateActiveNodeIfRemoved(
	removedNodeId: string,
): void {
	const settingsRow = localDb.select().from(settings).get();
	if (settingsRow?.lastActiveNodeId === removedNodeId) {
		const newActiveId = selectNextActiveNode();
		setLastActiveNode(newActiveId);
	}
}

/**
 * Fetch a node by ID.
 */
export function getNode(nodeId: string): SelectNode | undefined {
	return localDb
		.select()
		.from(nodes)
		.where(eq(nodes.id, nodeId))
		.get();
}

/**
 * Fetch a node by ID, excluding nodes that are being deleted.
 * Use this for operations that shouldn't operate on deleting nodes
 * (e.g., setActive, update, setUnread).
 */
export function getNodeNotDeleting(
	nodeId: string,
): SelectNode | undefined {
	return localDb
		.select()
		.from(nodes)
		.where(and(eq(nodes.id, nodeId), isNull(nodes.deletingAt)))
		.get();
}

/**
 * Fetch a repository by ID.
 */
export function getRepository(repositoryId: string): SelectRepository | undefined {
	return localDb
		.select()
		.from(repositories)
		.where(eq(repositories.id, repositoryId))
		.get();
}

/**
 * Fetch a worktree by ID.
 */
export function getWorktree(worktreeId: string): SelectWorktree | undefined {
	return localDb
		.select()
		.from(worktrees)
		.where(eq(worktrees.id, worktreeId))
		.get();
}

/**
 * Fetch a node with its related worktree and repository.
 * Returns null if node not found.
 */
export function getNodeWithRelations(nodeId: string): {
	node: SelectNode;
	worktree: SelectWorktree | null;
	repository: SelectRepository | null;
} | null {
	const node = getNode(nodeId);
	if (!node) {
		return null;
	}

	const worktree = node.worktreeId
		? (getWorktree(node.worktreeId) ?? null)
		: null;
	const repository = getRepository(node.repositoryId) ?? null;

	return { node, worktree, repository };
}

/**
 * Update a node's timestamps for lastOpenedAt and updatedAt.
 */
export function touchNode(
	nodeId: string,
	additionalFields?: Partial<{
		isUnread: boolean;
		branch: string;
		name: string;
	}>,
): void {
	const now = Date.now();
	localDb
		.update(nodes)
		.set({
			lastOpenedAt: now,
			updatedAt: now,
			...additionalFields,
		})
		.where(eq(nodes.id, nodeId))
		.run();
}

/** Hides node from queries immediately, before slow deletion operations. */
export function markNodeAsDeleting(nodeId: string): void {
	localDb
		.update(nodes)
		.set({ deletingAt: Date.now() })
		.where(eq(nodes.id, nodeId))
		.run();
}

/** Restores node visibility after a failed deletion. */
export function clearNodeDeletingStatus(nodeId: string): void {
	localDb
		.update(nodes)
		.set({ deletingAt: null })
		.where(eq(nodes.id, nodeId))
		.run();
}

/**
 * Delete a node record from the database.
 */
export function deleteNode(nodeId: string): void {
	localDb.delete(nodes).where(eq(nodes.id, nodeId)).run();
}

/**
 * Delete a worktree record from the database.
 */
export function deleteWorktreeRecord(worktreeId: string): void {
	localDb.delete(worktrees).where(eq(worktrees.id, worktreeId)).run();
}

/**
 * Get the branch node for a repository (excluding those being deleted).
 * Each repository can only have one branch node (type='branch').
 * Returns undefined if no branch node exists.
 */
export function getBranchNode(
	repositoryId: string,
): SelectNode | undefined {
	return localDb
		.select()
		.from(nodes)
		.where(
			and(
				eq(nodes.repositoryId, repositoryId),
				eq(nodes.type, "branch"),
				isNull(nodes.deletingAt),
			),
		)
		.get();
}

/**
 * Update a repository's default branch.
 */
export function updateRepositoryDefaultBranch(
	repositoryId: string,
	defaultBranch: string,
): void {
	localDb
		.update(repositories)
		.set({ defaultBranch })
		.where(eq(repositories.id, repositoryId))
		.run();
}
