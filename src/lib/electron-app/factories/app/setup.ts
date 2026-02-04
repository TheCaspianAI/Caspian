import { app, BrowserWindow, shell } from "electron";

import { installExtension, REACT_DEVELOPER_TOOLS } from "electron-extension-installer";
import { PLATFORM } from "shared/constants";
import { makeAppId } from "shared/utils";
import { ignoreConsoleWarnings } from "../../utils/ignore-console-warnings";

const isDev = process.env.NODE_ENV === "development";

ignoreConsoleWarnings(["Manifest version 2 is deprecated"]);

export async function makeAppSetup(
	createWindow: () => Promise<BrowserWindow>,
	restoreWindows?: () => Promise<void>,
) {
	if (isDev) {
		try {
			await installExtension([REACT_DEVELOPER_TOOLS], {
				loadExtensionOptions: {
					allowFileAccess: true,
				},
			});
		} catch {
			// DevTools installation can fail in CI/headless environments
		}
	}

	// Restore windows from previous session if available
	if (restoreWindows) {
		await restoreWindows();
	}

	// If no windows were restored, create a new one
	const existingWindows = BrowserWindow.getAllWindows();
	let window: BrowserWindow;
	if (existingWindows.length > 0) {
		window = existingWindows[0];
	} else {
		window = await createWindow();
	}

	app.on("activate", async () => {
		const windows = BrowserWindow.getAllWindows();

		if (!windows.length) {
			window = await createWindow();
		} else {
			for (window of windows.reverse()) {
				window.restore();
			}
		}
	});

	app.on("web-contents-created", (_, contents) =>
		contents.on("will-navigate", (event, url) => {
			// Always prevent in-app navigation for external URLs
			if (url.startsWith("http://") || url.startsWith("https://")) {
				event.preventDefault();
				shell.openExternal(url);
			}
		}),
	);

	app.on("window-all-closed", () => !PLATFORM.IS_MAC && app.quit());
	app.on("before-quit", () => {});

	return window;
}

PLATFORM.IS_LINUX && app.disableHardwareAcceleration();

PLATFORM.IS_WINDOWS && app.setAppUserModelId(isDev ? process.execPath : makeAppId());

app.commandLine.appendSwitch("force-color-profile", "srgb");

// Enable CSS backdrop-filter and GPU features for production builds
app.commandLine.appendSwitch("enable-features", "BackdropFilter,UseOzonePlatform");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
