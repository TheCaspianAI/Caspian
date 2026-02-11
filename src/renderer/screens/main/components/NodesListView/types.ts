export interface NodeItem {
	uniqueId: string;
	nodeId: string | null;
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
}

export interface RepositoryGroup {
	repositoryId: string;
	repositoryName: string;
	nodes: NodeItem[];
}

export type FilterMode = "all" | "active" | "closed";
