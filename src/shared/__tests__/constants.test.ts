import { describe, expect, test } from "bun:test";
import {
	CASPIAN_DIR_NAMES,
	CONFIG_FILE_NAME,
	CONFIG_TEMPLATE,
	DEFAULT_CONFIRM_ON_QUIT,
	NOTIFICATION_EVENTS,
	PLATFORM,
	PORTS,
	PORTS_FILE_NAME,
	REPOSITORY_CASPIAN_DIR_NAME,
	WORKTREES_DIR_NAME,
} from "../constants";

describe("constants", () => {
	describe("PLATFORM", () => {
		test("has all platform flags", () => {
			expect(PLATFORM).toHaveProperty("IS_MAC");
			expect(PLATFORM).toHaveProperty("IS_WINDOWS");
			expect(PLATFORM).toHaveProperty("IS_LINUX");
		});

		test("platform flags are booleans", () => {
			expect(typeof PLATFORM.IS_MAC).toBe("boolean");
			expect(typeof PLATFORM.IS_WINDOWS).toBe("boolean");
			expect(typeof PLATFORM.IS_LINUX).toBe("boolean");
		});

		test("exactly one platform flag is true", () => {
			const truePlatforms = [PLATFORM.IS_MAC, PLATFORM.IS_WINDOWS, PLATFORM.IS_LINUX].filter(
				Boolean,
			);
			expect(truePlatforms.length).toBe(1);
		});
	});

	describe("PORTS", () => {
		test("has required port configurations", () => {
			expect(PORTS).toHaveProperty("VITE_DEV_SERVER");
			expect(PORTS).toHaveProperty("NOTIFICATIONS");
			expect(PORTS).toHaveProperty("ELECTRIC");
		});

		test("ports are valid numbers", () => {
			expect(PORTS.VITE_DEV_SERVER).toBeGreaterThan(0);
			expect(PORTS.NOTIFICATIONS).toBeGreaterThan(0);
			expect(PORTS.ELECTRIC).toBeGreaterThan(0);
		});
	});

	describe("CASPIAN_DIR_NAMES", () => {
		test("has dev and prod directory names", () => {
			expect(CASPIAN_DIR_NAMES.DEV).toBe(".caspian-dev");
			expect(CASPIAN_DIR_NAMES.PROD).toBe(".caspian");
		});
	});

	describe("file and directory names", () => {
		test("repository caspian dir is .caspian", () => {
			expect(REPOSITORY_CASPIAN_DIR_NAME).toBe(".caspian");
		});

		test("worktrees directory name", () => {
			expect(WORKTREES_DIR_NAME).toBe("worktrees");
		});

		test("config file name", () => {
			expect(CONFIG_FILE_NAME).toBe("config.json");
		});

		test("ports file name", () => {
			expect(PORTS_FILE_NAME).toBe("ports.json");
		});
	});

	describe("CONFIG_TEMPLATE", () => {
		test("is valid JSON", () => {
			expect(() => JSON.parse(CONFIG_TEMPLATE)).not.toThrow();
		});

		test("has setup and teardown arrays", () => {
			const config = JSON.parse(CONFIG_TEMPLATE);
			expect(config).toHaveProperty("setup");
			expect(config).toHaveProperty("teardown");
			expect(Array.isArray(config.setup)).toBe(true);
			expect(Array.isArray(config.teardown)).toBe(true);
		});
	});

	describe("NOTIFICATION_EVENTS", () => {
		test("has required event types", () => {
			expect(NOTIFICATION_EVENTS.AGENT_LIFECYCLE).toBe("agent-lifecycle");
			expect(NOTIFICATION_EVENTS.FOCUS_TAB).toBe("focus-tab");
			expect(NOTIFICATION_EVENTS.TERMINAL_EXIT).toBe("terminal-exit");
		});
	});

	describe("defaults", () => {
		test("DEFAULT_CONFIRM_ON_QUIT is true", () => {
			expect(DEFAULT_CONFIRM_ON_QUIT).toBe(true);
		});
	});
});
