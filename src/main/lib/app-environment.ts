import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CASPIAN_DIR_NAME } from "shared/constants";

export const CASPIAN_HOME_DIR =
	process.env.CASPIAN_HOME_OVERRIDE || join(homedir(), CASPIAN_DIR_NAME);

export const CASPIAN_HOME_DIR_MODE = 0o700;
export const CASPIAN_SENSITIVE_FILE_MODE = 0o600;

export function ensureCaspianHomeDirExists(): void {
	if (!existsSync(CASPIAN_HOME_DIR)) {
		mkdirSync(CASPIAN_HOME_DIR, {
			recursive: true,
			mode: CASPIAN_HOME_DIR_MODE,
		});
	}

	// Best-effort repair if the directory already existed with weak permissions.
	try {
		chmodSync(CASPIAN_HOME_DIR, CASPIAN_HOME_DIR_MODE);
	} catch (error) {
		console.warn(
			"[app-environment] Failed to chmod Caspian home dir (best-effort):",
			CASPIAN_HOME_DIR,
			error,
		);
	}
}

// For lowdb - use our own path instead of app.getPath("userData")
export const APP_STATE_PATH = join(CASPIAN_HOME_DIR, "app-state.json");

// Window geometry state (separate from UI state - main process only, sync I/O)
export const WINDOW_STATE_PATH = join(CASPIAN_HOME_DIR, "window-state.json");
