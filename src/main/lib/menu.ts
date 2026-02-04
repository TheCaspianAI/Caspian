import { Menu } from "electron";
import { appState } from "main/lib/app-state";
import { hotkeysEmitter } from "main/lib/hotkeys-events";
import {
	getCurrentPlatform,
	getEffectiveHotkey,
	type HotkeyId,
	toElectronAccelerator,
} from "shared/hotkeys";
import { checkForUpdatesInteractive } from "./auto-updater";
import { menuEmitter } from "./menu-events";

let isHotkeyListenerRegistered = false;

function getMenuAccelerator(id: HotkeyId): string | undefined {
	const platform = getCurrentPlatform();
	const overrides = appState.data.hotkeysState.byPlatform[platform];
	const keys = getEffectiveHotkey(id, overrides, platform);
	const accelerator = toElectronAccelerator(keys, platform);
	return accelerator ?? undefined;
}

export function registerMenuHotkeyUpdates() {
	if (isHotkeyListenerRegistered) return;
	isHotkeyListenerRegistered = true;
	hotkeysEmitter.on("change", () => {
		createApplicationMenu();
	});
}

export function createApplicationMenu() {
	const closeAccelerator = getMenuAccelerator("CLOSE_WINDOW");
	const openSettingsAccelerator = getMenuAccelerator("OPEN_SETTINGS");

	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				{ role: "zoom" },
				{ type: "separator" },
				{ role: "close", accelerator: closeAccelerator },
			],
		},
	];

	if (process.platform === "darwin") {
		template.unshift({
			label: "Caspian",
			submenu: [
				{ label: "About Caspian", role: "about" },
				{ type: "separator" },
				{
					label: "Settings...",
					accelerator: openSettingsAccelerator,
					click: () => {
						menuEmitter.emit("open-settings");
					},
				},
				{
					label: "Check for Updates...",
					click: () => {
						checkForUpdatesInteractive();
					},
				},
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" },
			],
		});
	}

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}
