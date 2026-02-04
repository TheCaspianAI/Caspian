import { describe, expect, it } from "bun:test";
import {
	canonicalizeHotkey,
	canonicalizeHotkeyForPlatform,
	deriveNonMacDefault,
	formatHotkeyDisplay,
	formatHotkeyText,
	getDefaultHotkey,
	getEffectiveHotkey,
	getHotkeysByCategory,
	getVisibleHotkeys,
	hasPrimaryModifier,
	hotkeyFromKeyboardEvent,
	isOsReservedHotkey,
	isTerminalReservedEvent,
	isTerminalReservedHotkey,
	type KeyboardEventLike,
	matchesHotkeyEvent,
	toElectronAccelerator,
} from "./hotkeys";

describe("canonicalizeHotkey", () => {
	it("normalizes modifier order to meta+ctrl+alt+shift", () => {
		expect(canonicalizeHotkey("shift+meta+k")).toBe("meta+shift+k");
		expect(canonicalizeHotkey("alt+ctrl+k")).toBe("ctrl+alt+k");
		expect(canonicalizeHotkey("shift+alt+ctrl+meta+k")).toBe("meta+ctrl+alt+shift+k");
	});

	it("normalizes key aliases", () => {
		expect(canonicalizeHotkey("cmd+k")).toBe("meta+k");
		expect(canonicalizeHotkey("command+k")).toBe("meta+k");
		expect(canonicalizeHotkey("opt+k")).toBe("alt+k");
		expect(canonicalizeHotkey("option+k")).toBe("alt+k");
		expect(canonicalizeHotkey("control+k")).toBe("ctrl+k");
		expect(canonicalizeHotkey("ctl+k")).toBe("ctrl+k");
	});

	it("normalizes special keys", () => {
		expect(canonicalizeHotkey("meta+esc")).toBe("meta+escape");
		expect(canonicalizeHotkey("meta+return")).toBe("meta+enter");
		expect(canonicalizeHotkey("meta+arrowleft")).toBe("meta+left");
		expect(canonicalizeHotkey("meta+arrowright")).toBe("meta+right");
		expect(canonicalizeHotkey("meta+arrowup")).toBe("meta+up");
		expect(canonicalizeHotkey("meta+arrowdown")).toBe("meta+down");
	});

	it("normalizes space key", () => {
		expect(canonicalizeHotkey("meta+ ")).toBe("meta+space");
		expect(canonicalizeHotkey("meta+spacebar")).toBe("meta+space");
	});

	it("normalizes slash key", () => {
		expect(canonicalizeHotkey("meta+/")).toBe("meta+slash");
		expect(canonicalizeHotkey("meta+?")).toBe("meta+slash");
	});

	it("lowercases keys", () => {
		expect(canonicalizeHotkey("META+K")).toBe("meta+k");
		expect(canonicalizeHotkey("Ctrl+Shift+S")).toBe("ctrl+shift+s");
	});

	it("returns null for invalid hotkeys with multiple primary keys", () => {
		expect(canonicalizeHotkey("shift+meta+k+x")).toBeNull();
		expect(canonicalizeHotkey("a+b")).toBeNull();
	});

	it("returns null for modifier-only hotkeys", () => {
		expect(canonicalizeHotkey("meta+shift")).toBeNull();
		expect(canonicalizeHotkey("ctrl")).toBeNull();
	});

	it("handles single key hotkeys", () => {
		expect(canonicalizeHotkey("k")).toBe("k");
		expect(canonicalizeHotkey("escape")).toBe("escape");
	});
});

describe("canonicalizeHotkeyForPlatform", () => {
	it("accepts meta on darwin", () => {
		expect(canonicalizeHotkeyForPlatform("meta+k", "darwin")).toBe("meta+k");
	});

	it("rejects meta on non-mac platforms", () => {
		expect(canonicalizeHotkeyForPlatform("meta+k", "win32")).toBeNull();
		expect(canonicalizeHotkeyForPlatform("meta+k", "linux")).toBeNull();
	});

	it("accepts ctrl on all platforms", () => {
		expect(canonicalizeHotkeyForPlatform("ctrl+k", "darwin")).toBe("ctrl+k");
		expect(canonicalizeHotkeyForPlatform("ctrl+k", "win32")).toBe("ctrl+k");
		expect(canonicalizeHotkeyForPlatform("ctrl+k", "linux")).toBe("ctrl+k");
	});

	it("returns null for invalid hotkey", () => {
		expect(canonicalizeHotkeyForPlatform("invalid+key+combo", "darwin")).toBeNull();
	});
});

describe("deriveNonMacDefault", () => {
	it("returns null for null input", () => {
		expect(deriveNonMacDefault(null)).toBeNull();
	});

	it("returns null for invalid hotkey", () => {
		expect(deriveNonMacDefault("invalid+key+combo+extra")).toBeNull();
	});

	it("returns unchanged hotkey when no meta modifier present", () => {
		expect(deriveNonMacDefault("ctrl+k")).toBe("ctrl+k");
		expect(deriveNonMacDefault("alt+k")).toBe("alt+k");
		expect(deriveNonMacDefault("shift+k")).toBe("shift+k");
	});

	it("maps meta+key to ctrl+shift+key (simple meta case)", () => {
		expect(deriveNonMacDefault("meta+k")).toBe("ctrl+shift+k");
		expect(deriveNonMacDefault("meta+1")).toBe("ctrl+shift+1");
		expect(deriveNonMacDefault("meta+enter")).toBe("ctrl+shift+enter");
	});

	it("maps meta+shift to ctrl+alt+shift (adds alt for shifted defaults)", () => {
		expect(deriveNonMacDefault("meta+shift+w")).toBe("ctrl+alt+shift+w");
		expect(deriveNonMacDefault("meta+shift+n")).toBe("ctrl+alt+shift+n");
	});

	it("maps meta+alt to ctrl+alt+shift", () => {
		expect(deriveNonMacDefault("meta+alt+k")).toBe("ctrl+alt+shift+k");
		expect(deriveNonMacDefault("meta+alt+up")).toBe("ctrl+alt+shift+up");
	});

	it("handles meta+ctrl combinations", () => {
		expect(deriveNonMacDefault("meta+ctrl+k")).toBe("ctrl+shift+k");
	});
});

describe("matchesHotkeyEvent", () => {
	function createEvent(overrides: Partial<KeyboardEventLike>): KeyboardEventLike {
		return {
			key: "k",
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			metaKey: false,
			...overrides,
		};
	}

	it("matches simple meta hotkey", () => {
		const event = createEvent({ key: "k", metaKey: true });
		expect(matchesHotkeyEvent(event, "meta+k")).toBe(true);
		expect(matchesHotkeyEvent(event, "ctrl+k")).toBe(false);
	});

	it("matches hotkey with multiple modifiers", () => {
		const event = createEvent({ key: "w", metaKey: true, shiftKey: true });
		expect(matchesHotkeyEvent(event, "meta+shift+w")).toBe(true);
		expect(matchesHotkeyEvent(event, "meta+w")).toBe(false);
	});

	it("returns false if extra modifiers are pressed", () => {
		const event = createEvent({ key: "k", metaKey: true, altKey: true });
		expect(matchesHotkeyEvent(event, "meta+k")).toBe(false);
	});

	it("handles arrow key aliases", () => {
		expect(matchesHotkeyEvent(createEvent({ key: "ArrowLeft", metaKey: true }), "meta+left")).toBe(
			true,
		);
		expect(
			matchesHotkeyEvent(createEvent({ key: "ArrowRight", metaKey: true }), "meta+right"),
		).toBe(true);
		expect(matchesHotkeyEvent(createEvent({ key: "ArrowUp", metaKey: true }), "meta+up")).toBe(
			true,
		);
		expect(matchesHotkeyEvent(createEvent({ key: "ArrowDown", metaKey: true }), "meta+down")).toBe(
			true,
		);
	});

	it("handles slash key via code", () => {
		expect(
			matchesHotkeyEvent(createEvent({ key: "/", code: "Slash", metaKey: true }), "meta+slash"),
		).toBe(true);
	});

	it("returns false for invalid hotkey string", () => {
		expect(matchesHotkeyEvent(createEvent({ key: "k" }), "invalid+key+combo")).toBe(false);
	});
});

describe("hotkeyFromKeyboardEvent", () => {
	function createEvent(overrides: Partial<KeyboardEventLike>): KeyboardEventLike {
		return {
			key: "k",
			code: "KeyK",
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			metaKey: false,
			...overrides,
		};
	}

	it("captures a simple meta hotkey on mac", () => {
		const keys = hotkeyFromKeyboardEvent(createEvent({ key: "k", metaKey: true }), "darwin");
		expect(keys).toBe("meta+k");
	});

	it("captures a simple ctrl hotkey on all platforms", () => {
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", ctrlKey: true }), "darwin")).toBe(
			"ctrl+k",
		);
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", ctrlKey: true }), "win32")).toBe(
			"ctrl+k",
		);
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", ctrlKey: true }), "linux")).toBe(
			"ctrl+k",
		);
	});

	it("captures hotkey with multiple modifiers", () => {
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "w", metaKey: true, shiftKey: true }), "darwin"),
		).toBe("meta+shift+w");
	});

	it("returns null for modifier-only keys", () => {
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "Shift", shiftKey: true }), "darwin"),
		).toBeNull();
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "Control", ctrlKey: true }), "darwin"),
		).toBeNull();
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "Alt", altKey: true }), "darwin")).toBeNull();
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "Meta", metaKey: true }), "darwin"),
		).toBeNull();
	});

	it("returns null for dead/unidentified keys", () => {
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "Dead", metaKey: true }), "darwin"),
		).toBeNull();
		expect(
			hotkeyFromKeyboardEvent(createEvent({ key: "Unidentified", metaKey: true }), "darwin"),
		).toBeNull();
	});

	it("returns null if no primary modifier is pressed", () => {
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k" }), "darwin")).toBeNull();
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", altKey: true }), "darwin")).toBeNull();
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", shiftKey: true }), "darwin")).toBeNull();
	});

	it("returns null for meta on non-mac platforms", () => {
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", metaKey: true }), "win32")).toBeNull();
		expect(hotkeyFromKeyboardEvent(createEvent({ key: "k", metaKey: true }), "linux")).toBeNull();
	});
});

describe("formatHotkeyDisplay", () => {
	it("formats mac hotkeys with symbols", () => {
		expect(formatHotkeyDisplay("meta+k", "darwin")).toEqual(["⌘", "K"]);
		expect(formatHotkeyDisplay("meta+shift+k", "darwin")).toEqual(["⌘", "⇧", "K"]);
		expect(formatHotkeyDisplay("ctrl+alt+k", "darwin")).toEqual(["⌃", "⌥", "K"]);
	});

	it("formats windows hotkeys with text", () => {
		expect(formatHotkeyDisplay("ctrl+k", "win32")).toEqual(["Ctrl", "K"]);
		expect(formatHotkeyDisplay("ctrl+shift+k", "win32")).toEqual(["Ctrl", "Shift", "K"]);
		expect(formatHotkeyDisplay("ctrl+alt+k", "win32")).toEqual(["Ctrl", "Alt", "K"]);
	});

	it("formats linux hotkeys with text", () => {
		expect(formatHotkeyDisplay("ctrl+k", "linux")).toEqual(["Ctrl", "K"]);
		expect(formatHotkeyDisplay("ctrl+shift+k", "linux")).toEqual(["Ctrl", "Shift", "K"]);
	});

	it("formats special keys correctly", () => {
		expect(formatHotkeyDisplay("meta+enter", "darwin")).toEqual(["⌘", "↵"]);
		expect(formatHotkeyDisplay("meta+backspace", "darwin")).toEqual(["⌘", "⌫"]);
		expect(formatHotkeyDisplay("meta+escape", "darwin")).toEqual(["⌘", "⎋"]);
		expect(formatHotkeyDisplay("meta+tab", "darwin")).toEqual(["⌘", "⇥"]);
		expect(formatHotkeyDisplay("meta+up", "darwin")).toEqual(["⌘", "↑"]);
		expect(formatHotkeyDisplay("meta+down", "darwin")).toEqual(["⌘", "↓"]);
		expect(formatHotkeyDisplay("meta+left", "darwin")).toEqual(["⌘", "←"]);
		expect(formatHotkeyDisplay("meta+right", "darwin")).toEqual(["⌘", "→"]);
		expect(formatHotkeyDisplay("meta+space", "darwin")).toEqual(["⌘", "␣"]);
	});

	it("returns Unassigned for null or invalid hotkeys", () => {
		expect(formatHotkeyDisplay(null, "darwin")).toEqual(["Unassigned"]);
		expect(formatHotkeyDisplay("invalid+key+combo", "darwin")).toEqual(["Unassigned"]);
	});
});

describe("formatHotkeyText", () => {
	it("joins symbols without separator on mac", () => {
		expect(formatHotkeyText("meta+shift+k", "darwin")).toBe("⌘⇧K");
	});

	it("joins with + on non-mac platforms", () => {
		expect(formatHotkeyText("ctrl+shift+k", "win32")).toBe("Ctrl+Shift+K");
		expect(formatHotkeyText("ctrl+shift+k", "linux")).toBe("Ctrl+Shift+K");
	});

	it("returns Unassigned for null", () => {
		expect(formatHotkeyText(null, "darwin")).toBe("Unassigned");
	});
});

describe("toElectronAccelerator", () => {
	it("converts to electron accelerator for mac", () => {
		expect(toElectronAccelerator("meta+shift+w", "darwin")).toBe("Command+Shift+W");
		expect(toElectronAccelerator("meta+k", "darwin")).toBe("Command+K");
	});

	it("converts ctrl hotkeys for all platforms", () => {
		expect(toElectronAccelerator("ctrl+k", "darwin")).toBe("Ctrl+K");
		expect(toElectronAccelerator("ctrl+shift+k", "win32")).toBe("Ctrl+Shift+K");
		expect(toElectronAccelerator("ctrl+alt+k", "linux")).toBe("Ctrl+Alt+K");
	});

	it("converts special keys", () => {
		expect(toElectronAccelerator("meta+enter", "darwin")).toBe("Command+Enter");
		expect(toElectronAccelerator("meta+backspace", "darwin")).toBe("Command+Backspace");
		expect(toElectronAccelerator("meta+escape", "darwin")).toBe("Command+Escape");
		expect(toElectronAccelerator("meta+tab", "darwin")).toBe("Command+Tab");
		expect(toElectronAccelerator("meta+up", "darwin")).toBe("Command+Up");
		expect(toElectronAccelerator("meta+space", "darwin")).toBe("Command+Space");
		expect(toElectronAccelerator("meta+slash", "darwin")).toBe("Command+/");
	});

	it("returns null for meta on non-mac", () => {
		expect(toElectronAccelerator("meta+w", "win32")).toBeNull();
		expect(toElectronAccelerator("meta+w", "linux")).toBeNull();
	});

	it("returns null for null input", () => {
		expect(toElectronAccelerator(null, "darwin")).toBeNull();
	});

	it("returns null for invalid hotkey", () => {
		expect(toElectronAccelerator("invalid+key+combo", "darwin")).toBeNull();
	});
});

describe("isTerminalReservedHotkey", () => {
	it("detects terminal reserved hotkeys", () => {
		expect(isTerminalReservedHotkey("ctrl+c")).toBe(true);
		expect(isTerminalReservedHotkey("ctrl+d")).toBe(true);
		expect(isTerminalReservedHotkey("ctrl+z")).toBe(true);
		expect(isTerminalReservedHotkey("ctrl+s")).toBe(true);
		expect(isTerminalReservedHotkey("ctrl+q")).toBe(true);
		expect(isTerminalReservedHotkey("ctrl+\\")).toBe(true);
	});

	it("returns false for non-reserved hotkeys", () => {
		expect(isTerminalReservedHotkey("ctrl+k")).toBe(false);
		expect(isTerminalReservedHotkey("meta+c")).toBe(false);
	});

	it("returns false for invalid hotkey", () => {
		expect(isTerminalReservedHotkey("invalid")).toBe(false);
	});
});

describe("isTerminalReservedEvent", () => {
	it("detects ctrl+c", () => {
		expect(
			isTerminalReservedEvent({
				key: "c",
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
			}),
		).toBe(true);
	});

	it("detects ctrl+d", () => {
		expect(
			isTerminalReservedEvent({
				key: "d",
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
			}),
		).toBe(true);
	});

	it("returns false for non-reserved events", () => {
		expect(
			isTerminalReservedEvent({
				key: "k",
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
			}),
		).toBe(false);
	});
});

describe("isOsReservedHotkey", () => {
	it("detects darwin reserved hotkeys", () => {
		expect(isOsReservedHotkey("meta+q", "darwin")).toBe(true);
		expect(isOsReservedHotkey("meta+space", "darwin")).toBe(true);
		expect(isOsReservedHotkey("meta+tab", "darwin")).toBe(true);
	});

	it("detects win32 reserved hotkeys", () => {
		expect(isOsReservedHotkey("alt+f4", "win32")).toBe(true);
		expect(isOsReservedHotkey("alt+tab", "win32")).toBe(true);
		expect(isOsReservedHotkey("ctrl+alt+delete", "win32")).toBe(true);
	});

	it("detects linux reserved hotkeys", () => {
		expect(isOsReservedHotkey("alt+f4", "linux")).toBe(true);
		expect(isOsReservedHotkey("alt+tab", "linux")).toBe(true);
	});

	it("returns false for non-reserved hotkeys", () => {
		expect(isOsReservedHotkey("meta+k", "darwin")).toBe(false);
		expect(isOsReservedHotkey("ctrl+k", "win32")).toBe(false);
	});

	it("returns false for invalid hotkey", () => {
		expect(isOsReservedHotkey("invalid", "darwin")).toBe(false);
	});
});

describe("hasPrimaryModifier", () => {
	it("returns true for hotkeys with ctrl", () => {
		expect(hasPrimaryModifier("ctrl+k")).toBe(true);
		expect(hasPrimaryModifier("ctrl+shift+k")).toBe(true);
	});

	it("returns true for hotkeys with meta", () => {
		expect(hasPrimaryModifier("meta+k")).toBe(true);
		expect(hasPrimaryModifier("meta+shift+k")).toBe(true);
	});

	it("returns false for hotkeys without ctrl or meta", () => {
		expect(hasPrimaryModifier("alt+k")).toBe(false);
		expect(hasPrimaryModifier("shift+k")).toBe(false);
		expect(hasPrimaryModifier("k")).toBe(false);
	});
});

describe("HOTKEYS registry", () => {
	it("getVisibleHotkeys returns non-hidden hotkeys", () => {
		const visible = getVisibleHotkeys();
		expect(visible.length).toBeGreaterThan(0);
		expect(visible).not.toContain("NEW_WINDOW"); // Hidden hotkey
	});

	it("getHotkeysByCategory groups hotkeys correctly", () => {
		const grouped = getHotkeysByCategory();
		expect(grouped.Node.length).toBeGreaterThan(0);
		expect(grouped.Layout.length).toBeGreaterThan(0);
		expect(grouped.Terminal.length).toBeGreaterThan(0);
		expect(grouped.Window.length).toBeGreaterThan(0);
		expect(grouped.Help.length).toBeGreaterThan(0);
	});

	it("getDefaultHotkey returns platform-specific defaults", () => {
		expect(getDefaultHotkey("JUMP_TO_NODE_1", "darwin")).toBe("meta+1");
		expect(getDefaultHotkey("OPEN_SETTINGS", "darwin")).toBe("meta+,");
		expect(getDefaultHotkey("OPEN_SETTINGS", "win32")).toBe("ctrl+,");
	});

	it("getEffectiveHotkey respects overrides", () => {
		expect(getEffectiveHotkey("JUMP_TO_NODE_1", {}, "darwin")).toBe("meta+1");
		expect(getEffectiveHotkey("JUMP_TO_NODE_1", { JUMP_TO_NODE_1: "meta+0" }, "darwin")).toBe(
			"meta+0",
		);
		expect(getEffectiveHotkey("JUMP_TO_NODE_1", { JUMP_TO_NODE_1: null }, "darwin")).toBeNull();
	});
});
