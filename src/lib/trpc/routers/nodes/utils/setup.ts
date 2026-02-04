import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE_NAME, REPOSITORY_CASPIAN_DIR_NAME } from "shared/constants";
import type { SetupConfig } from "shared/types";

/**
 * Copies the .caspian directory from main repo to worktree if it exists in main but not in worktree.
 * This handles the case where .caspian is gitignored - worktrees won't have it since git only
 * includes tracked files. By copying it, setup scripts like "./.caspian/setup.sh" will work.
 */
export function copyCaspianConfigToWorktree(mainRepoPath: string, worktreePath: string): void {
	const mainCaspianDir = join(mainRepoPath, REPOSITORY_CASPIAN_DIR_NAME);
	const worktreeCaspianDir = join(worktreePath, REPOSITORY_CASPIAN_DIR_NAME);

	// Only copy if it exists in main repo but not in worktree
	if (existsSync(mainCaspianDir) && !existsSync(worktreeCaspianDir)) {
		try {
			cpSync(mainCaspianDir, worktreeCaspianDir, { recursive: true });
		} catch (error) {
			console.error(
				`Failed to copy ${REPOSITORY_CASPIAN_DIR_NAME} to worktree: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}

export function loadSetupConfig(mainRepoPath: string): SetupConfig | null {
	const configPath = join(mainRepoPath, REPOSITORY_CASPIAN_DIR_NAME, CONFIG_FILE_NAME);

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content) as SetupConfig;

		if (parsed.setup && !Array.isArray(parsed.setup)) {
			throw new Error("'setup' field must be an array of strings");
		}

		return parsed;
	} catch (error) {
		console.error(
			`Failed to read setup config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}
