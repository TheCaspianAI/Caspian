/**
 * Seed helpers for integration tests.
 *
 * Insert realistic test data (repositories, nodes, worktrees) into the
 * test database so procedures have data to operate on.
 */
import { v4 as uuidv4 } from "uuid";
import type { TestDb } from "./test-db";

interface SeedRepositoryOptions {
	id?: string;
	mainRepoPath: string;
	name?: string;
	color?: string;
	tabOrder?: number | null;
	defaultBranch?: string;
}

interface SeedNodeOptions {
	id?: string;
	repositoryId: string;
	type?: "branch" | "worktree";
	branch?: string;
	name?: string;
	tabOrder?: number;
	worktreeId?: string | null;
}

interface SeedWorktreeOptions {
	id?: string;
	repositoryId: string;
	path: string;
	branch: string;
	baseBranch?: string | null;
}

export function seedRepository(testDb: TestDb, options: SeedRepositoryOptions) {
	const id = options.id ?? uuidv4();
	const now = Date.now();

	testDb.sqlite.exec(
		`INSERT INTO projects (id, main_repo_path, name, color, tab_order, last_opened_at, created_at, default_branch)
		 VALUES ('${id}', '${options.mainRepoPath}', '${options.name ?? "test-repo"}', '${options.color ?? "blue"}', ${options.tabOrder ?? 0}, ${now}, ${now}, '${options.defaultBranch ?? "main"}')`,
	);

	return { id, mainRepoPath: options.mainRepoPath };
}

export function seedNode(testDb: TestDb, options: SeedNodeOptions) {
	const id = options.id ?? uuidv4();
	const now = Date.now();

	testDb.sqlite.exec(
		`INSERT INTO nodes (id, project_id, worktree_id, type, branch, name, tab_order, created_at, updated_at, last_opened_at)
		 VALUES ('${id}', '${options.repositoryId}', ${options.worktreeId ? `'${options.worktreeId}'` : "NULL"}, '${options.type ?? "branch"}', '${options.branch ?? "main"}', '${options.name ?? "main"}', ${options.tabOrder ?? 0}, ${now}, ${now}, ${now})`,
	);

	return { id };
}

export function seedWorktree(testDb: TestDb, options: SeedWorktreeOptions) {
	const id = options.id ?? uuidv4();
	const now = Date.now();

	testDb.sqlite.exec(
		`INSERT INTO worktrees (id, project_id, path, branch, base_branch, created_at)
		 VALUES ('${id}', '${options.repositoryId}', '${options.path}', '${options.branch}', ${options.baseBranch ? `'${options.baseBranch}'` : "NULL"}, ${now})`,
	);

	return { id };
}

export function setLastActiveNode(testDb: TestDb, nodeId: string) {
	testDb.sqlite.exec(`UPDATE settings SET last_active_node_id = '${nodeId}' WHERE id = 1`);
}
