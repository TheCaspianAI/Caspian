import { afterEach, describe, expect, mock, test } from "bun:test";

let execBehavior: Record<string, { stdout?: string; error?: Error }> = {};

mock.module("../../nodes/utils/shell-env", () => ({
	execWithShellEnv: mock((cmd: string, _args: string[]) => {
		const key = cmd;
		const behavior = execBehavior[key];
		if (behavior?.error) {
			return Promise.reject(behavior.error);
		}
		return Promise.resolve({ stdout: behavior?.stdout ?? "", stderr: "" });
	}),
}));

// Must import after mock.module call
const { checkToolStatus } = await import("./check-tools");

describe("checkToolStatus", () => {
	afterEach(() => {
		execBehavior = {};
	});

	test("returns git available when git --version succeeds", async () => {
		execBehavior.git = { stdout: "git version 2.39.0" };
		execBehavior.gh = { error: enoentError() };

		const result = await checkToolStatus();
		expect(result.git.available).toBe(true);
	});

	test("returns git unavailable when git --version fails", async () => {
		execBehavior.git = { error: enoentError() };
		execBehavior.gh = { error: enoentError() };

		const result = await checkToolStatus();
		expect(result.git.available).toBe(false);
	});

	test("returns gh not installed when gh --version fails with ENOENT", async () => {
		execBehavior.git = { stdout: "git version 2.39.0" };
		execBehavior.gh = { error: enoentError() };

		const result = await checkToolStatus();
		expect(result.gh.installed).toBe(false);
		expect(result.gh.authenticated).toBe(false);
		expect(result.gh.username).toBeNull();
	});

	test("returns gh installed but not authenticated when gh api user fails", async () => {
		execBehavior.git = { stdout: "git version 2.39.0" };
		execBehavior.gh = { stdout: "gh version 2.40.0" };

		let callCount = 0;
		const { execWithShellEnv } = await import("../../nodes/utils/shell-env");
		(execWithShellEnv as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
			if (cmd === "git") return Promise.resolve({ stdout: "git version 2.39.0", stderr: "" });
			if (cmd === "gh") {
				callCount++;
				if (callCount <= 1) {
					return Promise.resolve({ stdout: "gh version 2.40.0", stderr: "" });
				}
				return Promise.reject(new Error("not logged in"));
			}
			return Promise.reject(enoentError());
		});

		const result = await checkToolStatus();
		expect(result.gh.installed).toBe(true);
		expect(result.gh.authenticated).toBe(false);
		expect(result.gh.username).toBeNull();
	});

	test("returns gh authenticated with username when gh api user succeeds", async () => {
		let callCount = 0;
		const { execWithShellEnv } = await import("../../nodes/utils/shell-env");
		(execWithShellEnv as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
			if (cmd === "git") return Promise.resolve({ stdout: "git version 2.39.0", stderr: "" });
			if (cmd === "gh") {
				callCount++;
				if (callCount <= 1) {
					return Promise.resolve({ stdout: "gh version 2.40.0", stderr: "" });
				}
				return Promise.resolve({ stdout: "testuser\n", stderr: "" });
			}
			return Promise.reject(enoentError());
		});

		const result = await checkToolStatus();
		expect(result.gh.installed).toBe(true);
		expect(result.gh.authenticated).toBe(true);
		expect(result.gh.username).toBe("testuser");
	});
});

function enoentError(): Error & { code: string } {
	const err = new Error("spawn gh ENOENT") as Error & { code: string };
	err.code = "ENOENT";
	return err;
}
