import type { Theme } from "../types";

/**
 * Hex theme — Deep noir with dusty rose accent
 *
 * Near-black backgrounds with warm rose undertone (oklch hue ~15).
 * Dusty rose/salmon primary accent. Warm cream text.
 * Inspired by hex.tech's editorial dark aesthetic.
 *
 * Surface hierarchy:
 *   0.11 (input) → 0.14 (sidebar) → 0.16 (background)
 *   → 0.19 (tertiary) → 0.21 (card) → 0.25 (accent) → 0.29 (popover)
 */
export const hexTheme: Theme = {
	id: "hex",
	name: "Hex",
	author: "Caspian",
	type: "dark",
	isBuiltIn: true,
	description: "Deep noir with dusty rose accent — inspired by hex.tech",

	ui: {
		// Core surfaces — near-black with rose undertone
		background: "oklch(0.16 0.012 15)",
		foreground: "oklch(0.90 0.025 65)",
		navForeground: "oklch(0.65 0.015 25)",

		card: "oklch(0.21 0.012 15)",
		cardForeground: "oklch(0.90 0.025 65)",

		popover: "oklch(0.29 0.015 15)",
		popoverForeground: "oklch(0.90 0.025 65)",

		// Primary — dusty rose / salmon
		primary: "oklch(0.68 0.10 15)",
		primaryForeground: "oklch(0.16 0.012 15)",

		secondary: "oklch(0.25 0.015 15)",
		secondaryForeground: "oklch(0.90 0.025 65)",

		muted: "oklch(0.21 0.012 15)",
		mutedForeground: "oklch(0.58 0.015 25)",

		// Accent — hover/active surface
		accent: "oklch(0.25 0.018 15)",
		accentForeground: "oklch(0.88 0.025 65)",

		tertiary: "oklch(0.19 0.012 15)",
		tertiaryActive: "oklch(0.23 0.012 15)",

		// Destructive — red, slightly warmer to match theme
		destructive: "#c04848",
		destructiveForeground: "#c04848",

		// Borders — very subtle
		border: "oklch(1 0 0 / 0.09)",
		input: "oklch(0.11 0.012 15)",
		ring: "oklch(0.68 0.10 15)",

		// Sidebar — darker plane
		sidebar: "oklch(0.14 0.012 15)",
		sidebarForeground: "oklch(0.90 0.025 65)",
		sidebarPrimary: "oklch(0.68 0.10 15)",
		sidebarPrimaryForeground: "oklch(0.16 0.012 15)",
		sidebarAccent: "oklch(0.25 0.018 15)",
		sidebarAccentForeground: "oklch(0.88 0.025 65)",
		sidebarBorder: "oklch(1 0 0 / 0.09)",
		sidebarRing: "oklch(0.68 0.10 15)",

		// Charts — rose-warm spectrum
		chart1: "oklch(0.60 0.10 15)",
		chart2: "oklch(0.65 0.08 45)",
		chart3: "oklch(0.55 0.06 340)",
		chart4: "oklch(0.70 0.07 70)",
		chart5: "oklch(0.50 0.09 25)",
	},

	terminal: {
		background: "transparent",
		foreground: "#d4c8c0",
		cursor: "#d4c8c0",
		cursorAccent: "#1e1a1b",
		selectionBackground: "rgba(80, 60, 65, 0.5)",

		// Warm-shifted ANSI — rose-tinted darks
		black: "#2a2426",
		red: "#c85858",
		green: "#7ea070",
		yellow: "#c0a868",
		blue: "#7090b0",
		magenta: "#b07090",
		cyan: "#689098",
		white: "#d0c8c4",

		brightBlack: "#584e52",
		brightRed: "#d87070",
		brightGreen: "#98c090",
		brightYellow: "#d8c080",
		brightBlue: "#88a8c8",
		brightMagenta: "#c888a8",
		brightCyan: "#80b0b8",
		brightWhite: "#e8e0dc",
	},
};
