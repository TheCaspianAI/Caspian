import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAllRepositoriesHealth, checkRepositoryHealth } from "./health";

const TEST_DIR = join(tmpdir(), `caspian-health-test-${Date.now()}`);

beforeAll(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("checkRepositoryHealth", () => {
	it("returns healthy when the path exists on disk", () => {
		const result = checkRepositoryHealth({ mainRepoPath: TEST_DIR });
		expect(result).toEqual({ healthy: true });
	});

	it("returns unhealthy with path_missing when the path does not exist", () => {
		const result = checkRepositoryHealth({
			mainRepoPath: join(TEST_DIR, "nonexistent-repo"),
		});
		expect(result).toEqual({ healthy: false, reason: "path_missing" });
	});

	it("returns unhealthy for an empty string path", () => {
		const result = checkRepositoryHealth({ mainRepoPath: "" });
		expect(result).toEqual({ healthy: false, reason: "path_missing" });
	});
});

describe("checkAllRepositoriesHealth", () => {
	it("returns a map with health status for each repository", () => {
		const repos = [
			{ id: "repo-1", mainRepoPath: TEST_DIR },
			{ id: "repo-2", mainRepoPath: join(TEST_DIR, "nonexistent") },
		];

		const results = checkAllRepositoriesHealth(repos);

		expect(results.size).toBe(2);
		expect(results.get("repo-1")).toEqual({ healthy: true });
		expect(results.get("repo-2")).toEqual({ healthy: false, reason: "path_missing" });
	});

	it("returns an empty map for an empty array", () => {
		const results = checkAllRepositoriesHealth([]);
		expect(results.size).toBe(0);
	});
});
