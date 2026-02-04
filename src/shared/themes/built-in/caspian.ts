import type { Theme } from "../types";

/**
 * Caspian v2 theme - Gold-standard reference theme
 *
 * Design principles:
 * - No pure black backgrounds (#0b0d10 minimum)
 * - Soft white foreground (#f2f4f8) with blue undertone
 * - Transparent borders using rgba overlays
 * - Pink accent (#e91e8c) reserved for: active states, selection, primary CTA, focus ring
 * - Clear tonal layering from background → tertiary → card → muted → accent
 */
export const caspianTheme: Theme = {
	id: "caspian",
	name: "Caspian",
	author: "Caspian",
	type: "dark",
	isBuiltIn: true,
	description: "Gold-standard Caspian theme — calm black surfaces with disciplined pink accents",

	ui: {
		background: "#0b0d10",
		foreground: "#f2f4f8",

		card: "#111216",
		cardForeground: "#f2f4f8",

		popover: "#111216",
		popoverForeground: "#f2f4f8",

		primary: "#e91e8c",
		primaryForeground: "#ffffff",

		secondary: "#15171c",
		secondaryForeground: "#f2f4f8",

		muted: "#1b1d23",
		mutedForeground: "#9aa0aa",

		accent: "#15171c",
		accentForeground: "#f2f4f8",

		tertiary: "#0e1014",
		tertiaryActive: "#15171c",

		destructive: "#ff4d6a",
		destructiveForeground: "#ffffff",

		border: "rgba(242, 244, 248, 0.12)",
		input: "rgba(242, 244, 248, 0.16)",
		ring: "#e91e8c",

		sidebar: "#0e1014",
		sidebarForeground: "#f2f4f8",
		sidebarPrimary: "#e91e8c",
		sidebarPrimaryForeground: "#ffffff",
		sidebarAccent: "#15171c",
		sidebarAccentForeground: "#f2f4f8",
		sidebarBorder: "rgba(242, 244, 248, 0.10)",
		sidebarRing: "#e91e8c",

		chart1: "#e91e8c",
		chart2: "#ff6eb4",
		chart3: "#ff9ecf",
		chart4: "#f2f4f8",
		chart5: "#9aa0aa",
	},

	terminal: {
		background: "#0b0d10",
		foreground: "#f2f4f8",
		cursor: "#e91e8c",
		cursorAccent: "#0b0d10",
		selectionBackground: "rgba(233, 30, 140, 0.28)",

		black: "#0e1014",
		red: "#ff4d6a",
		green: "#4ade80",
		yellow: "#fbbf24",
		blue: "#60a5fa",
		magenta: "#e91e8c",
		cyan: "#22d3ee",
		white: "#f2f4f8",

		brightBlack: "#3a3f47",
		brightRed: "#ff6b84",
		brightGreen: "#86efac",
		brightYellow: "#fcd34d",
		brightBlue: "#93c5fd",
		brightMagenta: "#ff6eb4",
		brightCyan: "#67e8f9",
		brightWhite: "#ffffff",
	},
};
