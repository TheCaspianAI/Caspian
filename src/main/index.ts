import path from "node:path";
import { app, BrowserWindow, dialog, nativeImage } from "electron";
import { makeAppSetup } from "lib/electron-app/factories/app/setup";
import { settings } from "lib/local-db";
import { DEFAULT_CONFIRM_ON_QUIT, PROTOCOL_SCHEME } from "shared/constants";
import { setupAgentHooks } from "./lib/agent-setup";
import { initAppState } from "./lib/app-state";
import { setupAutoUpdater } from "./lib/auto-updater";
import { localDb } from "./lib/local-db";
import { validateRepositoryPaths } from "./lib/repository-health";
import { initSentry } from "./lib/sentry";
import { reconcileDaemonSessions } from "./lib/terminal";
import { disposeTray, initTray } from "./lib/tray";
import { MainWindow } from "./windows/main";

// Initialize local SQLite database (runs migrations + legacy data migration on import)
console.log("[main] Local database ready:", !!localDb);

// Set app name
app.setName("Caspian");

// Set dock icon on macOS (after app is ready)
if (process.platform === "darwin") {
	app.whenReady().then(() => {
		if (app.dock) {
			// Use PNG for dock icon
			const iconPath = path.join(process.cwd(), "src/resources/build/icons/icon.png");
			console.log("[main] Setting dock icon from:", iconPath);
			try {
				const icon = nativeImage.createFromPath(iconPath);
				console.log("[main] Icon loaded, isEmpty:", icon.isEmpty());
				if (!icon.isEmpty()) {
					app.dock.setIcon(icon);
					console.log("[main] Dock icon set successfully");
				}
			} catch (e) {
				console.error("[main] Failed to set dock icon:", e);
			}
		}
	});
}

// Register protocol handler for deep linking
// In development, we need to provide the execPath and args
if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
			path.resolve(process.argv[1]),
		]);
	}
} else {
	app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

async function processDeepLink(url: string): Promise<void> {
	console.log("[main] Processing deep link:", url);

	// Extract path and navigate in renderer
	// e.g. caspian://settings/appearance -> /settings/appearance
	const deepLinkPath = `/${url.split("://")[1]}`;

	focusMainWindow();

	// Navigate in renderer via loading the route directly
	const windows = BrowserWindow.getAllWindows();
	if (windows.length > 0) {
		const mainWindow = windows[0];
		// Send navigation request to renderer
		mainWindow.webContents.send("deep-link-navigate", deepLinkPath);
	}
}

/**
 * Find a deep link URL in argv
 */
function findDeepLinkInArgv(argv: string[]): string | undefined {
	return argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
}

/**
 * Focus the main window (show and bring to front)
 */
function focusMainWindow(): void {
	const windows = BrowserWindow.getAllWindows();
	if (windows.length > 0) {
		const mainWindow = windows[0];
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.show();
		mainWindow.focus();
	}
}

// Handle deep links when app is already running (macOS)
app.on("open-url", async (event, url) => {
	event.preventDefault();
	await processDeepLink(url);
});

let isQuitting = false;
let skipConfirmation = false;

/**
 * Check if the user has enabled the confirm-on-quit setting
 */
function getConfirmOnQuitSetting(): boolean {
	try {
		const row = localDb.select().from(settings).get();
		return row?.confirmOnQuit ?? DEFAULT_CONFIRM_ON_QUIT;
	} catch {
		return DEFAULT_CONFIRM_ON_QUIT;
	}
}

/**
 * Skip the confirmation dialog for the next quit (e.g., auto-updater)
 */
export function setSkipQuitConfirmation(): void {
	skipConfirmation = true;
}

/**
 * Skip the confirmation dialog and quit immediately
 */
export function quitWithoutConfirmation(): void {
	skipConfirmation = true;
	app.exit(0);
}

app.on("before-quit", async (event) => {
	if (isQuitting) return;

	const shouldConfirm = !skipConfirmation && !isE2ETest && getConfirmOnQuitSetting();

	if (shouldConfirm) {
		event.preventDefault();

		try {
			const { response } = await dialog.showMessageBox({
				type: "question",
				buttons: ["Quit", "Cancel"],
				defaultId: 0,
				cancelId: 1,
				title: "Quit Caspian",
				message: "Are you sure you want to quit?",
			});

			if (response === 1) {
				// User cancelled
				return;
			}
		} catch (error) {
			console.error("[main] Quit confirmation dialog failed:", error);
		}
	}

	// Quit confirmed or no confirmation needed - exit immediately
	// Let OS clean up child processes, tray, etc.
	isQuitting = true;
	disposeTray();
	app.exit(0);
});

process.on("uncaughtException", (error) => {
	if (isQuitting) return;
	console.error("[main] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
	if (isQuitting) return;
	console.error("[main] Unhandled rejection:", reason);
});

// Handle termination signals (e.g., when dev server stops via Ctrl+C)
// Without these handlers, Electron may not quit when electron-vite sends SIGTERM
if (process.env.NODE_ENV === "development") {
	const handleTerminationSignal = (signal: string) => {
		console.log(`[main] Received ${signal}, quitting...`);
		// Use app.exit() to bypass before-quit async cleanup which can hang
		app.exit(0);
	};

	process.on("SIGTERM", () => handleTerminationSignal("SIGTERM"));
	process.on("SIGINT", () => handleTerminationSignal("SIGINT"));

	// Monitor parent process (electron-vite CLI) and quit if it exits.
	// This is a fallback for when signals don't propagate correctly.
	// When electron-vite receives Ctrl+C, it may exit without properly
	// signaling the child Electron process to quit.
	const parentPid = process.ppid;
	const checkParentAlive = (): boolean => {
		try {
			// Signal 0 doesn't actually send a signal, just checks if process exists
			process.kill(parentPid, 0);
			return true;
		} catch {
			return false;
		}
	};

	const parentCheckInterval = setInterval(() => {
		if (!checkParentAlive()) {
			console.log("[main] Parent process exited, quitting...");
			clearInterval(parentCheckInterval);
			// Use app.exit() instead of app.quit() to bypass the before-quit
			// handler's async cleanup which can hang in dev mode
			app.exit(0);
		}
	}, 1000);
	parentCheckInterval.unref();
}

// Single instance lock - required for second-instance event on Windows/Linux
// Skip in E2E test mode to allow tests to launch alongside a dev instance.
// Uses a custom env var because process.env.NODE_ENV is replaced at build time.
const isE2ETest = process.env.CASPIAN_E2E_TEST === "1";
const gotTheLock = isE2ETest || app.requestSingleInstanceLock();

if (!gotTheLock) {
	// Another instance is already running, exit immediately without triggering before-quit
	app.exit(0);
} else {
	// Handle deep links when second instance is launched (Windows/Linux)
	app.on("second-instance", async (_event, argv) => {
		focusMainWindow();
		const url = findDeepLinkInArgv(argv);
		if (url) {
			await processDeepLink(url);
		}
	});

	(async () => {
		await app.whenReady();

		initSentry();

		await initAppState();

		validateRepositoryPaths();

		// Clean up stale daemon sessions from previous app runs
		// Must happen BEFORE renderer restore runs
		await reconcileDaemonSessions();

		try {
			setupAgentHooks();
		} catch (error) {
			console.error("[main] Failed to set up agent hooks:", error);
			// App can continue without agent hooks, but log the failure
		}

		await makeAppSetup(() => MainWindow());
		setupAutoUpdater();

		// Initialize system tray (macOS menu bar icon for daemon management)
		initTray();

		// Handle cold-start deep links (Windows/Linux - app launched via deep link)
		const coldStartUrl = findDeepLinkInArgv(process.argv);
		if (coldStartUrl) {
			await processDeepLink(coldStartUrl);
		}
	})();
}
