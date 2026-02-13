import { describe, expect, test } from "bun:test";
import { everforestTheme } from "./everforest";
import { githubDarkTheme } from "./github-dark";
import { githubLightTheme } from "./github-light";
import { graceTheme } from "./grace";
import { hexTheme } from "./hex";
import { rosePineTheme } from "./rose-pine";

const ALL_THEMES = [
	graceTheme,
	everforestTheme,
	githubDarkTheme,
	githubLightTheme,
	hexTheme,
	rosePineTheme,
];

describe("built-in themes completeness", () => {
	for (const theme of ALL_THEMES) {
		describe(theme.name, () => {
			test("has navForeground defined", () => {
				expect(theme.ui.navForeground).toBeDefined();
				expect(typeof theme.ui.navForeground).toBe("string");
				expect(theme.ui.navForeground!.length).toBeGreaterThan(0);
			});

			test("has all required UIColors fields", () => {
				const requiredFields = [
					"background",
					"foreground",
					"card",
					"cardForeground",
					"popover",
					"popoverForeground",
					"primary",
					"primaryForeground",
					"secondary",
					"secondaryForeground",
					"muted",
					"mutedForeground",
					"accent",
					"accentForeground",
					"tertiary",
					"tertiaryActive",
					"destructive",
					"destructiveForeground",
					"border",
					"input",
					"ring",
					"sidebar",
					"sidebarForeground",
					"sidebarPrimary",
					"sidebarPrimaryForeground",
					"sidebarAccent",
					"sidebarAccentForeground",
					"sidebarBorder",
					"sidebarRing",
					"chart1",
					"chart2",
					"chart3",
					"chart4",
					"chart5",
				] as const;

				for (const field of requiredFields) {
					expect(theme.ui[field]).toBeDefined();
					expect(typeof theme.ui[field]).toBe("string");
				}
			});

			test("has all required terminal color fields", () => {
				expect(theme.terminal).toBeDefined();
				const terminal = theme.terminal!;

				const requiredFields = [
					"background",
					"foreground",
					"cursor",
					"cursorAccent",
					"selectionBackground",
					"black",
					"red",
					"green",
					"yellow",
					"blue",
					"magenta",
					"cyan",
					"white",
					"brightBlack",
					"brightRed",
					"brightGreen",
					"brightYellow",
					"brightBlue",
					"brightMagenta",
					"brightCyan",
					"brightWhite",
				] as const;

				for (const field of requiredFields) {
					expect(terminal[field]).toBeDefined();
					expect(typeof terminal[field]).toBe("string");
				}
			});

			test("has valid theme metadata", () => {
				expect(theme.id).toBeDefined();
				expect(theme.name).toBeDefined();
				expect(["dark", "light"]).toContain(theme.type);
				expect(theme.isBuiltIn).toBe(true);
			});
		});
	}
});
