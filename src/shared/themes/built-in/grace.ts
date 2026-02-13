import type { Theme } from "../types";

/**
 * Grace theme — Antimetal-inspired
 *
 * Deep near-neutral dark palette with warm cream text and ivory accent.
 * Backgrounds have barely perceptible warm hint (oklch hue ~70, chroma ~0.004).
 * Foreground and accent use warm cream (oklch hue ~80, chroma 0.025-0.035).
 * Inspired by Antimetal's premium dark aesthetic.
 */
export const graceTheme: Theme = {
	id: "grace",
	name: "Grace",
	author: "Caspian",
	type: "dark",
	isBuiltIn: true,
	description: "Antimetal-inspired — deep neutral dark with warm cream accent",

	ui: {
		// Core backgrounds — near-neutral deep darks
		// Tight spread: 0.11 (input) → 0.13 (base) → 0.15 (card) → 0.17 (overlay)
		background: "oklch(0.13 0.004 70)",
		foreground: "oklch(0.90 0.025 80)",
		navForeground: "oklch(0.68 0.015 75)",

		card: "oklch(0.15 0.004 70)",
		cardForeground: "oklch(0.90 0.025 80)",

		popover: "oklch(0.17 0.005 70)",
		popoverForeground: "oklch(0.90 0.025 80)",

		// Primary — cream/ivory accent
		primary: "oklch(0.88 0.035 80)",
		primaryForeground: "oklch(0.13 0.004 70)",

		secondary: "oklch(0.16 0.004 70)",
		secondaryForeground: "oklch(0.90 0.025 80)",

		muted: "oklch(0.15 0.004 70)",
		mutedForeground: "oklch(0.55 0.01 70)",

		// Accent — hover surface
		accent: "oklch(0.18 0.006 72)",
		accentForeground: "oklch(0.88 0.025 78)",

		tertiary: "oklch(0.14 0.004 70)",
		tertiaryActive: "oklch(0.16 0.004 70)",

		// Destructive — unchanged
		destructive: "#c04040",
		destructiveForeground: "#c04040",

		// Borders — subtle white at 10%
		border: "oklch(1 0 0 / 0.10)",
		input: "oklch(0.11 0.003 70)",
		ring: "oklch(0.88 0.035 80)",

		// Sidebar — matches background
		sidebar: "oklch(0.13 0.004 70)",
		sidebarForeground: "oklch(0.90 0.025 80)",
		sidebarPrimary: "oklch(0.88 0.035 80)",
		sidebarPrimaryForeground: "oklch(0.13 0.004 70)",
		sidebarAccent: "oklch(0.18 0.006 72)",
		sidebarAccentForeground: "oklch(0.88 0.025 78)",
		sidebarBorder: "oklch(1 0 0 / 0.10)",
		sidebarRing: "oklch(0.88 0.035 80)",

		// Charts — neutral with subtle warm shift
		chart1: "oklch(0.50 0.008 72)",
		chart2: "oklch(0.60 0.010 74)",
		chart3: "oklch(0.70 0.012 76)",
		chart4: "oklch(0.40 0.006 70)",
		chart5: "oklch(0.55 0.009 73)",
	},

	terminal: {
		background: "transparent",
		foreground: "#cccccc",
		cursor: "#d4d4d4",
		cursorAccent: "#141414",
		selectionBackground: "#363636",

		// Desaturated ANSI colors
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
