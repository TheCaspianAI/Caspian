/**
 * Integration tests for repository relocate and remove procedures.
 *
 * Tests the repositories.relocate and repositories.remove tRPC procedures
 * against a real SQLite database with mocked Electron dialogs.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedNode, seedRepository, seedWorktree, setLastActiveNode } from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { createTestCaller } from "./helpers/trpc-caller";

const TEST_DIR = join(tmpdir(), `caspian-relocate-remove-test-${Date.now()}`);

beforeAll(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

// =============================================================================
// repositories.remove
// =============================================================================

describe("repositories.remove", () => {
	test("deletes repository, nodes, and worktrees from DB", async () => {
		const db = createTestDb();
		const repoDir = join(TEST_DIR, "remove-repo-1");
		mkdirSync(repoDir, { recursive: true });

		const repo = seedRepository(db, { mainRepoPath: repoDir, name: "to-remove" });
		const wt = seedWorktree(db, {
			repositoryId: repo.id,
			path: join(repoDir, "wt-1"),
			branch: "feat-1",
		});
		seedNode(db, { repositoryId: repo.id, type: "branch", branch: "main", name: "main" });
		seedNode(db, {
			repositoryId: repo.id,
			type: "worktree",
			branch: "feat-1",
			name: "feat-1",
			worktreeId: wt.id,
			tabOrder: 1,
		});

		const caller = await createTestCaller(db);
		const result = await caller.repositories.remove({ id: repo.id });

		expect(result).toEqual({ success: true });

		// Verify repository is gone
		const repos = db.sqlite.query("SELECT * FROM projects WHERE id = ?").all(repo.id);
		expect(repos.length).toBe(0);

		// Verify nodes are gone
		const nodes = db.sqlite.query("SELECT * FROM nodes WHERE project_id = ?").all(repo.id);
		expect(nodes.length).toBe(0);

		// Verify worktrees are gone
		const worktrees = db.sqlite.query("SELECT * FROM worktrees WHERE project_id = ?").all(repo.id);
		expect(worktrees.length).toBe(0);

		db.sqlite.close();
	});

	test("updates lastActiveNodeId when removing active node's repository", async () => {
		const db = createTestDb();
		const dir1 = join(TEST_DIR, "remove-active-1");
		const dir2 = join(TEST_DIR, "remove-active-2");
		mkdirSync(dir1, { recursive: true });
		mkdirSync(dir2, { recursive: true });

		const repo1 = seedRepository(db, { mainRepoPath: dir1, name: "repo-1", tabOrder: 0 });
		const repo2 = seedRepository(db, { mainRepoPath: dir2, name: "repo-2", tabOrder: 1 });

		const node1 = seedNode(db, { repositoryId: repo1.id, branch: "main", name: "main" });
		const node2 = seedNode(db, { repositoryId: repo2.id, branch: "main", name: "main" });

		// Set node1 as active
		setLastActiveNode(db, node1.id);

		const caller = await createTestCaller(db);
		await caller.repositories.remove({ id: repo1.id });

		// After removing repo1, lastActiveNodeId should switch to node2
		const settings = db.sqlite
			.query("SELECT last_active_node_id FROM settings WHERE id = 1")
			.get() as { last_active_node_id: string | null } | undefined;
		expect(settings?.last_active_node_id).toBe(node2.id);

		db.sqlite.close();
	});

	test("throws NOT_FOUND for non-existent repository", async () => {
		const db = createTestDb();
		const caller = await createTestCaller(db);

		await expect(caller.repositories.remove({ id: "non-existent-id" })).rejects.toThrow(
			"Repository not found",
		);

		db.sqlite.close();
	});
});

// =============================================================================
// repositories.relocate
// =============================================================================

describe("repositories.relocate", () => {
	test("returns canceled when getWindow returns null (no window)", async () => {
		const db = createTestDb();
		const repoDir = join(TEST_DIR, "relocate-no-window");
		mkdirSync(repoDir, { recursive: true });

		const repo = seedRepository(db, { mainRepoPath: repoDir, name: "relocate-test" });

		// The test caller creates the router with getWindow: () => null,
		// so relocate should throw INTERNAL_SERVER_ERROR
		const caller = await createTestCaller(db);
		await expect(caller.repositories.relocate({ id: repo.id })).rejects.toThrow(
			"No window available",
		);

		db.sqlite.close();
	});

	test("throws NOT_FOUND for non-existent repository", async () => {
		const db = createTestDb();
		const caller = await createTestCaller(db);

		await expect(caller.repositories.relocate({ id: "non-existent" })).rejects.toThrow(
			"Repository not found",
		);

		db.sqlite.close();
	});
});

// =============================================================================
// repositories.get
// =============================================================================

describe("repositories.get", () => {
	test("returns a repository by id", async () => {
		const db = createTestDb();
		const repoDir = join(TEST_DIR, "get-repo-1");
		mkdirSync(repoDir, { recursive: true });

		const repo = seedRepository(db, {
			mainRepoPath: repoDir,
			name: "my-repo",
			color: "green",
			defaultBranch: "main",
		});

		const caller = await createTestCaller(db);
		const result = await caller.repositories.get({ id: repo.id });

		expect(result.id).toBe(repo.id);
		expect(result.name).toBe("my-repo");
		expect(result.mainRepoPath).toBe(repoDir);

		db.sqlite.close();
	});

	test("throws NOT_FOUND for non-existent repository", async () => {
		const db = createTestDb();
		const caller = await createTestCaller(db);

		await expect(caller.repositories.get({ id: "non-existent" })).rejects.toThrow("not found");

		db.sqlite.close();
	});
});

// =============================================================================
// nodes.get — pathMissing in single node query
// =============================================================================

describe("nodes.get with pathMissing", () => {
	test("returns pathMissing: true when repo directory is missing", async () => {
		const db = createTestDb();

		const repo = seedRepository(db, {
			mainRepoPath: join(TEST_DIR, "node-get-missing-repo"),
			name: "missing",
			tabOrder: 0,
		});
		const node = seedNode(db, { repositoryId: repo.id, branch: "main", name: "main" });

		const caller = await createTestCaller(db);
		const result = await caller.nodes.get({ id: node.id });

		expect(result.repository).toBeDefined();
		expect(result.repository!.pathMissing).toBe(true);

		db.sqlite.close();
	});

	test("returns pathMissing: false when repo directory exists", async () => {
		const db = createTestDb();
		const repoDir = join(TEST_DIR, "node-get-existing-repo");
		mkdirSync(repoDir, { recursive: true });

		const repo = seedRepository(db, { mainRepoPath: repoDir, name: "exists", tabOrder: 0 });
		const node = seedNode(db, { repositoryId: repo.id, branch: "main", name: "main" });

		const caller = await createTestCaller(db);
		const result = await caller.nodes.get({ id: node.id });

		expect(result.repository).toBeDefined();
		expect(result.repository!.pathMissing).toBe(false);

		db.sqlite.close();
	});
});
