import { describe, expect, test } from "bun:test";
import type { UIColors } from "shared/themes/types";
import { applyUIColors, clearThemeVariables, updateThemeClass } from "./css-variables";

describe("css-variables exports", () => {
	test("applyUIColors is exported", () => {
		expect(typeof applyUIColors).toBe("function");
	});

	test("clearThemeVariables is exported", () => {
		expect(typeof clearThemeVariables).toBe("function");
	});

	test("updateThemeClass is exported", () => {
		expect(typeof updateThemeClass).toBe("function");
	});
});

describe("applyUIColors", () => {
	test("sets CSS variables for all UIColors keys including navForeground", () => {
		const calls: Array<[string, string]> = [];
		const mockRoot = {
			style: {
				setProperty: (name: string, value: string) => {
					calls.push([name, value]);
				},
			},
		};

		const originalDocument = globalThis.document;
		Object.defineProperty(globalThis, "document", {
			value: { documentElement: mockRoot },
			writable: true,
			configurable: true,
		});

		const testColors: UIColors = {
			background: "#000",
			foreground: "#fff",
			navForeground: "#aaa",
			card: "#111",
			cardForeground: "#eee",
			popover: "#222",
			popoverForeground: "#ddd",
			primary: "#333",
			primaryForeground: "#ccc",
			secondary: "#444",
			secondaryForeground: "#bbb",
			muted: "#555",
			mutedForeground: "#999",
			accent: "#666",
			accentForeground: "#888",
			tertiary: "#777",
			tertiaryActive: "#776",
			destructive: "#f00",
			destructiveForeground: "#fff",
			border: "#333",
			input: "#444",
			ring: "#555",
			sidebar: "#111",
			sidebarForeground: "#eee",
			sidebarPrimary: "#222",
			sidebarPrimaryForeground: "#ddd",
			sidebarAccent: "#333",
			sidebarAccentForeground: "#ccc",
			sidebarBorder: "#444",
			sidebarRing: "#555",
			chart1: "#c01",
			chart2: "#c02",
			chart3: "#c03",
			chart4: "#c04",
			chart5: "#c05",
		};

		applyUIColors(testColors);

		Object.defineProperty(globalThis, "document", {
			value: originalDocument,
			writable: true,
			configurable: true,
		});

		// navForeground should be mapped to --nav-foreground
		const navCall = calls.find(([name]) => name === "--nav-foreground");
		expect(navCall).toBeDefined();
		expect(navCall![1]).toBe("#aaa");

		// All UIColors keys should have been set (testColors has 34 keys)
		expect(calls.length).toBe(Object.keys(testColors).length);

		// Spot-check a few more
		expect(calls.find(([n]) => n === "--background")?.[1]).toBe("#000");
		expect(calls.find(([n]) => n === "--sidebar-border")?.[1]).toBe("#444");
	});
});

describe("clearThemeVariables", () => {
	test("removes all CSS variables including --nav-foreground", () => {
		const removed: string[] = [];
		const mockRoot = {
			style: {
				removeProperty: (name: string) => {
					removed.push(name);
				},
			},
		};

		const originalDocument = globalThis.document;
		Object.defineProperty(globalThis, "document", {
			value: { documentElement: mockRoot },
			writable: true,
			configurable: true,
		});

		clearThemeVariables();

		Object.defineProperty(globalThis, "document", {
			value: originalDocument,
			writable: true,
			configurable: true,
		});

		expect(removed).toContain("--nav-foreground");
		expect(removed).toContain("--background");
		expect(removed).toContain("--sidebar-border");
		expect(removed.length).toBeGreaterThanOrEqual(34);
	});
});
