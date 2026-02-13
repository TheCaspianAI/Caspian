/**
 * Integration test setup.
 *
 * Mocks external dependencies (Electron, analytics, node-runtime) while
 * providing a real SQLite database via bun:sqlite + Drizzle ORM.
 *
 * This file must be preloaded before integration tests via bunfig.
 */
import { mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.SKIP_ENV_VALIDATION = "1";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GH_CLIENT_ID = "test-github-client-id";

const testTmpDir = join(tmpdir(), "caspian-integration-test");

// =============================================================================
// Electron module mock
// =============================================================================

mock.module("electron", () => ({
	app: {
		getPath: mock(() => testTmpDir),
		getName: mock(() => "test-app"),
		getVersion: mock(() => "1.0.0"),
		getAppPath: mock(() => testTmpDir),
		isPackaged: false,
	},
	dialog: {
		showOpenDialog: mock(() => Promise.resolve({ canceled: false, filePaths: [] })),
		showSaveDialog: mock(() => Promise.resolve({ canceled: false, filePath: "" })),
		showMessageBox: mock(() => Promise.resolve({ response: 0 })),
	},
	BrowserWindow: mock(() => ({
		webContents: { send: mock() },
		loadURL: mock(),
		on: mock(),
	})),
	ipcMain: {
		handle: mock(),
		on: mock(),
	},
	shell: {
		openExternal: mock(() => Promise.resolve()),
		openPath: mock(() => Promise.resolve("")),
	},
	clipboard: {
		writeText: mock(),
		readText: mock(() => ""),
	},
	screen: {
		getPrimaryDisplay: mock(() => ({
			workAreaSize: { width: 1920, height: 1080 },
			bounds: { x: 0, y: 0, width: 1920, height: 1080 },
		})),
		getAllDisplays: mock(() => [
			{
				bounds: { x: 0, y: 0, width: 1920, height: 1080 },
				workAreaSize: { width: 1920, height: 1080 },
			},
		]),
	},
	Notification: mock(() => ({
		show: mock(),
		on: mock(),
	})),
	Menu: {
		buildFromTemplate: mock(() => ({})),
		setApplicationMenu: mock(),
	},
	session: {
		defaultSession: {
			clearStorageData: mock(() => Promise.resolve()),
			clearCache: mock(() => Promise.resolve()),
		},
	},
	nativeImage: {
		createFromPath: mock(() => ({ isEmpty: () => true, toDataURL: () => "" })),
		createEmpty: mock(() => ({ isEmpty: () => true, toDataURL: () => "" })),
	},
}));

// =============================================================================
// Analytics mock
// =============================================================================

mock.module("main/lib/analytics", () => ({
	track: mock(() => {}),
	setUserId: mock(() => {}),
	clearUserCache: mock(() => {}),
	shutdown: mock(() => Promise.resolve()),
}));

// =============================================================================
// Node runtime mock (terminal management)
// =============================================================================

const mockTerminal = {
	killByWorkspaceId: mock(() => Promise.resolve({ failed: 0 })),
	getSessionCountByWorkspaceId: mock(() => Promise.resolve(0)),
	createOrAttach: mock(() => Promise.resolve()),
	kill: mock(() => Promise.resolve()),
	createSession: mock(() => Promise.resolve()),
	resize: mock(() => Promise.resolve()),
	write: mock(() => Promise.resolve()),
	management: {
		listSessions: mock(() => Promise.resolve({ sessions: [] })),
	},
};

const mockRuntime = {
	terminal: mockTerminal,
};

mock.module("main/lib/node-runtime", () => ({
	getNodeRuntimeRegistry: () => ({
		getForNodeId: () => mockRuntime,
		getDefault: () => mockRuntime,
	}),
}));

// =============================================================================
// Main process module mocks (avoid pulling in Tray, auto-updater, etc.)
// =============================================================================

mock.module("main/index", () => ({
	quitWithoutConfirmation: mock(() => {}),
}));

mock.module("main/lib/app-state", () => ({
	initAppState: mock(() => Promise.resolve()),
	appState: new Proxy(
		{},
		{
			get: () => ({}),
			set: () => true,
		},
	),
}));

mock.module("main/lib/app-state/schemas", () => ({
	defaultAppState: {},
}));

mock.module("main/lib/hotkeys-events", () => {
	const EventEmitter = require("node:events");
	return {
		hotkeysEmitter: new EventEmitter(),
	};
});

mock.module("main/lib/node-init-manager", () => ({
	nodeInitManager: {
		getStatus: mock(() => null),
		onStatusChange: mock(() => () => {}),
		start: mock(() => Promise.resolve()),
		cancel: mock(() => {}),
		isInitializing: mock(() => false),
		waitForInit: mock(() => Promise.resolve()),
		acquireRepositoryLock: mock(() => Promise.resolve()),
		releaseRepositoryLock: mock(() => {}),
		clearJob: mock(() => {}),
	},
}));

mock.module("main/lib/terminal", () => ({
	getDaemonTerminalManager: mock(() => ({
		getDaemonClient: mock(() => null),
	})),
}));

mock.module("main/lib/terminal/errors", () => ({
	TERMINAL_SESSION_KILLED_MESSAGE: "Session was killed",
	TerminalKilledError: class extends Error {},
}));

mock.module("main/lib/terminal-host/client", () => ({
	getTerminalHostClient: mock(() => ({
		listSessions: mock(() => Promise.resolve({ sessions: [] })),
	})),
}));

mock.module("main/lib/static-ports", () => ({
	hasStaticPortsConfig: mock(() => false),
	loadStaticPorts: mock(() => []),
	staticPortsWatcher: {
		on: mock(() => {}),
		off: mock(() => {}),
	},
}));

mock.module("main/lib/terminal/port-manager", () => ({
	portManager: {
		getPorts: mock(() => []),
		onPortsChange: mock(() => () => {}),
	},
}));

mock.module("main/lib/notifications/server", () => {
	const EventEmitter = require("node:events");
	return {
		notificationsEmitter: new EventEmitter(),
		notificationsApp: {
			getNotifications: mock(() => []),
			markRead: mock(() => {}),
			markAllRead: mock(() => {}),
			clear: mock(() => {}),
		},
		mapEventType: mock(() => "info"),
	};
});

mock.module("main/lib/menu-events", () => {
	const EventEmitter = require("node:events");
	return {
		menuEmitter: new EventEmitter(),
	};
});

mock.module("main/lib/auto-updater", () => {
	const EventEmitter = require("node:events");
	return {
		autoUpdateEmitter: new EventEmitter(),
		getUpdateStatus: mock(() => ({ status: "idle" })),
		installUpdate: mock(() => {}),
		dismissUpdate: mock(() => {}),
		checkForUpdates: mock(() => {}),
		checkForUpdatesInteractive: mock(() => {}),
		simulateUpdateReady: mock(() => {}),
		simulateDownloading: mock(() => {}),
		simulateError: mock(() => {}),
		setupAutoUpdater: mock(() => {}),
	};
});

// =============================================================================
// Browser globals (needed if any shared code references DOM)
// =============================================================================

// biome-ignore lint/suspicious/noExplicitAny: Test setup requires extending globalThis
(globalThis as any).document = {
	documentElement: {
		style: {
			setProperty: () => {},
			getPropertyValue: () => "",
		},
		classList: {
			add: () => {},
			remove: () => {},
			toggle: () => {},
			contains: () => false,
		},
	},
	head: { appendChild: () => {}, removeChild: () => {} },
	getElementsByTagName: () => [],
	createElement: () => ({
		setAttribute: () => {},
		appendChild: () => {},
		textContent: "",
		type: "",
	}),
	createTextNode: (text: string) => ({ textContent: text }),
};

// biome-ignore lint/suspicious/noExplicitAny: Test setup requires extending globalThis
(globalThis as any).electronTRPC = {
	sendMessage: () => {},
	onMessage: () => {},
};
