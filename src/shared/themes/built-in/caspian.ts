import type { Theme } from "../types";

/**
 * Caspian theme — Instrument Panel
 *
 * Pure monochromatic palette. Hierarchy through luminosity alone.
 * No accent color, no pink, no warm tints. Zero chroma.
 */
export const caspianTheme: Theme = {
	id: "caspian",
	name: "Caspian",
	author: "Caspian",
	type: "dark",
	isBuiltIn: true,
	description: "Instrument Panel — monochromatic precision with engineered restraint",

	ui: {
		background: "#1e1e1e",
		foreground: "#d4d4d4",
		navForeground: "#ababab",

		card: "#222222",
		cardForeground: "#d4d4d4",

		popover: "#282828",
		popoverForeground: "#d4d4d4",

		primary: "#d4d4d4",
		primaryForeground: "#1e1e1e",

		secondary: "#282828",
		secondaryForeground: "#d4d4d4",

		muted: "#222222",
		mutedForeground: "#858585",

		accent: "#282828",
		accentForeground: "#d4d4d4",

		tertiary: "#222222",
		tertiaryActive: "#282828",

		destructive: "#c04040",
		destructiveForeground: "#c04040",

		border: "#343434",
		input: "#181818",
		ring: "#4a4a4a",

		sidebar: "#1e1e1e",
		sidebarForeground: "#d4d4d4",
		sidebarPrimary: "#d4d4d4",
		sidebarPrimaryForeground: "#1e1e1e",
		sidebarAccent: "#282828",
		sidebarAccentForeground: "#d4d4d4",
		sidebarBorder: "#303030",
		sidebarRing: "#4a4a4a",

		chart1: "#808080",
		chart2: "#999999",
		chart3: "#b3b3b3",
		chart4: "#666666",
		chart5: "#8c8c8c",
	},

	terminal: {
		background: "transparent",
		foreground: "#cccccc",
		cursor: "#d4d4d4",
		cursorAccent: "#181818",
		selectionBackground: "#404040",

		// Desaturated ANSI colors for monochromatic environment
		black: "#2a2a2a",
		red: "#c04040",
		green: "#50a050",
		yellow: "#b0a040",
		blue: "#4070b0",
		magenta: "#806090",
		cyan: "#408090",
		white: "#c8c8c8",

		brightBlack: "#606060",
		brightRed: "#d06060",
		brightGreen: "#80c080",
		brightYellow: "#d0c870",
		brightBlue: "#7090c0",
		brightMagenta: "#a080a0",
		brightCyan: "#60b0c0",
		brightWhite: "#e8e8e8",
	},
};
