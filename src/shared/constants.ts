const isDev = process.env.NODE_ENV === "development";

export const PLATFORM = {
	IS_MAC: process.platform === "darwin",
	IS_WINDOWS: process.platform === "win32",
	IS_LINUX: process.platform === "linux",
};

// Ports - different for dev vs prod to allow running both simultaneously
export const PORTS = {
	VITE_DEV_SERVER: isDev ? 5927 : 4927,
	NOTIFICATIONS: isDev ? 31416 : 31415,
	// Electric SQL proxy port (local-first sync)
	ELECTRIC: isDev ? 31418 : 31417,
};

// Note: For environment-aware paths, use main/lib/app-environment.ts instead.
// Paths require Node.js/Electron APIs that aren't available in renderer.
export const CASPIAN_DIR_NAMES = {
	DEV: ".caspian-dev",
	PROD: ".caspian",
} as const;
export const CASPIAN_DIR_NAME = isDev
	? CASPIAN_DIR_NAMES.DEV
	: CASPIAN_DIR_NAMES.PROD;

// Deep link protocol scheme (environment-aware)
export const PROTOCOL_SCHEME = isDev ? "caspian-dev" : "caspian";
// Repository-level directory name (always .caspian, not conditional)
export const REPOSITORY_CASPIAN_DIR_NAME = ".caspian";
export const WORKTREES_DIR_NAME = "worktrees";
export const CONFIG_FILE_NAME = "config.json";
export const PORTS_FILE_NAME = "ports.json";

export const CONFIG_TEMPLATE = `{
  "setup": [],
  "teardown": []
}`;

export const NOTIFICATION_EVENTS = {
	AGENT_LIFECYCLE: "agent-lifecycle",
	FOCUS_TAB: "focus-tab",
	TERMINAL_EXIT: "terminal-exit",
} as const;

// Development/testing mock values (used when SKIP_ENV_VALIDATION is set)
export const MOCK_ORG_ID = "mock-org-id";

// Default user preference values
export const DEFAULT_CONFIRM_ON_QUIT = true;
export const DEFAULT_TERMINAL_LINK_BEHAVIOR = "external-editor" as const;
export const DEFAULT_AUTO_APPLY_DEFAULT_PRESET = true;

// External links (documentation, help resources, etc.)
export const EXTERNAL_LINKS = {
	SETUP_TEARDOWN_SCRIPTS: "https://docs.trycaspianai.com/setup-teardown-scripts",
} as const;
