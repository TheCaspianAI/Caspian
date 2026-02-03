import type { BrowserWindow } from "electron";
import { router } from "..";
import { createAnalyticsRouter } from "./analytics";
import { createAutoUpdateRouter } from "./auto-update";
import { createCacheRouter } from "./cache";
import { createChangesRouter } from "./changes";
import { createConfigRouter } from "./config";
import { createExternalRouter } from "./external";
import { createFilesystemRouter } from "./filesystem";
import { createHotkeysRouter } from "./hotkeys";
import { createMenuRouter } from "./menu";
import { createNotificationsRouter } from "./notifications";
import { createPortsRouter } from "./ports";
import { createRepositoriesRouter } from "./repositories";
import { createSettingsRouter } from "./settings";
import { createTerminalRouter } from "./terminal";
import { createUiStateRouter } from "./ui-state";
import { createWindowRouter } from "./window";
import { createNodesRouter } from "./nodes";

export const createAppRouter = (getWindow: () => BrowserWindow | null) => {
	return router({
		analytics: createAnalyticsRouter(),
		autoUpdate: createAutoUpdateRouter(),
		cache: createCacheRouter(),
		window: createWindowRouter(getWindow),
		repositories: createRepositoriesRouter(getWindow),
		nodes: createNodesRouter(),
		terminal: createTerminalRouter(),
		changes: createChangesRouter(),
		filesystem: createFilesystemRouter(),
		notifications: createNotificationsRouter(),
		ports: createPortsRouter(),
		menu: createMenuRouter(),
		hotkeys: createHotkeysRouter(getWindow),
		external: createExternalRouter(),
		settings: createSettingsRouter(),
		config: createConfigRouter(),
		uiState: createUiStateRouter(),
	});
};

export type AppRouter = ReturnType<typeof createAppRouter>;
