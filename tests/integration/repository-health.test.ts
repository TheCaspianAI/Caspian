/**
 * Integration tests for repository health checking.
 *
 * Tests the checkRepositoryHealth utility, the getAllGrouped
 * tRPC procedure's pathMissing flag, and the health cache
 * invalidation flow against a real SQLite database.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	checkAllRepositoriesHealth,
	checkRepositoryHealth,
} from "lib/trpc/routers/repositories/utils/health";
import { seedNode, seedRepository } from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { createTestCaller } from "./helpers/trpc-caller";

// Temp directory for test repos
const TEST_DIR = join(tmpdir(), `caspian-health-test-${Date.now()}`);

let testDb: TestDb;

beforeAll(() => {
	mkdirSync(TEST_DIR, { recursive: true });
	testDb = createTestDb();
});

afterAll(() => {
	testDb.sqlite.close();
	rmSync(TEST_DIR, { recursive: true, force: true });
});

// =============================================================================
// checkRepositoryHealth (pure function, no DB needed)
// =============================================================================

describe("checkRepositoryHealth", () => {
	test("returns healthy for an existing directory", () => {
		const repoDir = join(TEST_DIR, "existing-repo");
		mkdirSync(repoDir, { recursive: true });

		const result = checkRepositoryHealth({ mainRepoPath: repoDir });

		expect(result).toEqual({ healthy: true });
	});

	test("returns unhealthy with path_missing for a non-existent directory", () => {
		const result = checkRepositoryHealth({
			mainRepoPath: join(TEST_DIR, "does-not-exist"),
		});

		expect(result).toEqual({ healthy: false, reason: "path_missing" });
	});

	test("detects when a directory is moved away", () => {
		const original = join(TEST_DIR, "will-be-moved");
		const moved = join(TEST_DIR, "moved-here");
		mkdirSync(original, { recursive: true });

		// Initially healthy
		expect(checkRepositoryHealth({ mainRepoPath: original })).toEqual({
			healthy: true,
		});

		// Move it
		renameSync(original, moved);

		// Original path is now unhealthy
		expect(checkRepositoryHealth({ mainRepoPath: original })).toEqual({
			healthy: false,
			reason: "path_missing",
		});

		// New path is healthy
		expect(checkRepositoryHealth({ mainRepoPath: moved })).toEqual({
			healthy: true,
		});
	});
});

// =============================================================================
// checkAllRepositoriesHealth (batch check)
// =============================================================================

describe("checkAllRepositoriesHealth", () => {
	test("returns health status for multiple repositories", () => {
		const existingDir = join(TEST_DIR, "batch-existing");
		mkdirSync(existingDir, { recursive: true });

		const repos = [
			{ id: "repo-1", mainRepoPath: existingDir },
			{ id: "repo-2", mainRepoPath: join(TEST_DIR, "batch-missing") },
		];

		const results = checkAllRepositoriesHealth(repos);

		expect(results.size).toBe(2);
		expect(results.get("repo-1")).toEqual({ healthy: true });
		expect(results.get("repo-2")).toEqual({ healthy: false, reason: "path_missing" });
	});

	test("returns empty map for empty input", () => {
		const results = checkAllRepositoriesHealth([]);
		expect(results.size).toBe(0);
	});
});

// =============================================================================
// getAllGrouped procedure — pathMissing integration
// =============================================================================

describe("getAllGrouped with pathMissing", () => {
	test("marks repository as pathMissing when directory is absent", async () => {
		const db = createTestDb();

		// Seed a repo pointing to a non-existent path
		const repo = seedRepository(db, {
			mainRepoPath: join(TEST_DIR, "missing-for-grouped"),
			name: "missing-repo",
			tabOrder: 0,
		});
		seedNode(db, {
			repositoryId: repo.id,
			type: "branch",
			branch: "main",
			name: "main",
		});

		const caller = await createTestCaller(db);
		const groups = await caller.nodes.getAllGrouped();

		expect(groups.length).toBeGreaterThanOrEqual(1);
		const group = groups.find((g) => g.repository.id === repo.id);
		expect(group).toBeDefined();
		expect(group!.repository.pathMissing).toBe(true);

		db.sqlite.close();
	});

	test("marks repository as NOT pathMissing when directory exists", async () => {
		const db = createTestDb();

		const repoDir = join(TEST_DIR, "exists-for-grouped");
		mkdirSync(repoDir, { recursive: true });

		const repo = seedRepository(db, {
			mainRepoPath: repoDir,
			name: "existing-repo",
			tabOrder: 0,
		});
		seedNode(db, {
			repositoryId: repo.id,
			type: "branch",
			branch: "main",
			name: "main",
		});

		const caller = await createTestCaller(db);
		const groups = await caller.nodes.getAllGrouped();

		const group = groups.find((g) => g.repository.id === repo.id);
		expect(group).toBeDefined();
		expect(group!.repository.pathMissing).toBe(false);

		db.sqlite.close();
	});

	test("correctly groups nodes by repository", async () => {
		const db = createTestDb();

		const dir1 = join(TEST_DIR, "grouped-repo-1");
		const dir2 = join(TEST_DIR, "grouped-repo-2");
		mkdirSync(dir1, { recursive: true });
		mkdirSync(dir2, { recursive: true });

		const repo1 = seedRepository(db, { mainRepoPath: dir1, name: "repo-1", tabOrder: 0 });
		const repo2 = seedRepository(db, { mainRepoPath: dir2, name: "repo-2", tabOrder: 1 });

		seedNode(db, {
			repositoryId: repo1.id,
			type: "branch",
			branch: "main",
			name: "main",
			tabOrder: 0,
		});
		seedNode(db, {
			repositoryId: repo1.id,
			type: "worktree",
			branch: "feat-1",
			name: "feat-1",
			tabOrder: 1,
		});
		seedNode(db, {
			repositoryId: repo2.id,
			type: "branch",
			branch: "main",
			name: "main",
			tabOrder: 0,
		});

		const caller = await createTestCaller(db);
		const groups = await caller.nodes.getAllGrouped();

		const group1 = groups.find((g) => g.repository.id === repo1.id);
		const group2 = groups.find((g) => g.repository.id === repo2.id);

		expect(group1!.nodes.length).toBe(2);
		expect(group2!.nodes.length).toBe(1);

		// Verify sort order (by tabOrder)
		expect(groups[0].repository.tabOrder).toBeLessThanOrEqual(groups[1].repository.tabOrder);

		db.sqlite.close();
	});
});

// =============================================================================
// Health cache invalidation
// =============================================================================

describe("health cache invalidation", () => {
	test("pathMissing flips from true to false after directory creation and invalidation", async () => {
		const db = createTestDb();
		const missingDir = join(TEST_DIR, "cache-invalidation-test");

		// Seed a repo pointing to a path that does not exist yet
		const repo = seedRepository(db, {
			mainRepoPath: missingDir,
			name: "cache-test-repo",
			tabOrder: 0,
		});
		seedNode(db, {
			repositoryId: repo.id,
			type: "branch",
			branch: "main",
			name: "main",
		});

		// Set up mock and import modules
		mock.module("main/lib/local-db", () => ({ localDb: db.db }));
		const { invalidateRepositoryHealthCache } = await import(
			"lib/trpc/routers/repositories/utils/health-cache"
		);

		const caller = await createTestCaller(db);

		// First query: directory does not exist, expect pathMissing = true
		const groupsBefore = await caller.nodes.getAllGrouped();
		const groupBefore = groupsBefore.find((g) => g.repository.id === repo.id);
		expect(groupBefore).toBeDefined();
		expect(groupBefore!.repository.pathMissing).toBe(true);

		// Create the directory on disk
		mkdirSync(missingDir, { recursive: true });

		// Invalidate cache so the next query picks up the change
		invalidateRepositoryHealthCache();

		// Second query: directory now exists, expect pathMissing = false
		const groupsAfter = await caller.nodes.getAllGrouped();
		const groupAfter = groupsAfter.find((g) => g.repository.id === repo.id);
		expect(groupAfter).toBeDefined();
		expect(groupAfter!.repository.pathMissing).toBe(false);

		db.sqlite.close();
	});
});
