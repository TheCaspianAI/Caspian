import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SetupConfig } from "shared/types";
import { getShellEnvironment } from "./shell-env";

const execAsync = promisify(exec);

const TEARDOWN_TIMEOUT_MS = 60_000; // 60 seconds

export interface TeardownResult {
	success: boolean;
	error?: string;
}

function loadSetupConfig(mainRepoPath: string): SetupConfig | null {
	const configPath = join(mainRepoPath, ".caspian", "config.json");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content) as SetupConfig;

		if (parsed.teardown && !Array.isArray(parsed.teardown)) {
			throw new Error("'teardown' field must be an array of strings");
		}

		return parsed;
	} catch (error) {
		console.error(
			`Failed to read setup config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

export async function runTeardown(
	mainRepoPath: string,
	worktreePath: string,
	nodeName: string,
	customTeardownScript?: string | null,
): Promise<TeardownResult> {
	// Use custom teardown script if provided, otherwise load from repository config
	let commands: string[];

	if (customTeardownScript?.trim()) {
		commands = [customTeardownScript.trim()];
	} else {
		// Load config from the main repo (where .caspian/config.json lives)
		const config = loadSetupConfig(mainRepoPath);
		if (!config?.teardown || config.teardown.length === 0) {
			return { success: true };
		}
		commands = config.teardown;
	}

	const command = commands.join(" && ");

	try {
		const shellEnv = await getShellEnvironment();

		await execAsync(command, {
			cwd: worktreePath,
			timeout: TEARDOWN_TIMEOUT_MS,
			env: {
				...shellEnv,
				CASPIAN_NODE_NAME: nodeName,
				CASPIAN_ROOT_PATH: mainRepoPath,
			},
		});

		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`Teardown failed for node ${nodeName}:`,
			errorMessage,
		);
		return {
			success: false,
			error: errorMessage,
		};
	}
}
