export interface NodeItem {
	// Unique identifier - either node id or worktree id for closed ones
	uniqueId: string;
	// If open, this is the node id
	nodeId: string | null;
	// For closed worktrees, this is the worktree id
	worktreeId: string | null;
	repositoryId: string;
	repositoryName: string;
	worktreePath: string;
	type: "worktree" | "branch";
	branch: string;
	name: string;
	lastOpenedAt: number;
	createdAt: number;
	isUnread: boolean;
	isOpen: boolean;
	worktreePathExists: boolean;
}

export interface RepositoryGroup {
	repositoryId: string;
	repositoryName: string;
	nodes: NodeItem[];
}

export type FilterMode = "all" | "active" | "closed";
