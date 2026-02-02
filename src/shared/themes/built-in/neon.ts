import type { Theme } from "../types";

/**
 * Neon theme - Monochromatic magenta/pink cyberpunk aesthetic
 * Primary color: #ff7aed (oklch ~0.75 0.26 328)
 *
 * All colors derived from variations of the base pink hue.
 * Creates an immersive, glowing cyberpunk atmosphere.
 */
export const neonTheme: Theme = {
	id: "neon",
	name: "Neon",
	author: "Caspian",
	description: "Monochromatic neon pink cyberpunk theme",
	type: "dark",
	isBuiltIn: true,

	ui: {
		// Core backgrounds - very dark with subtle pink undertone
		background: "oklch(0.08 0.02 328)",
		foreground: "oklch(0.95 0.02 328)",

		// Card/Panel - slightly elevated from background
		card: "oklch(0.12 0.03 328)",
		cardForeground: "oklch(0.95 0.02 328)",

		// Popover/Dropdown - elevated surfaces
		popover: "oklch(0.14 0.04 328)",
		popoverForeground: "oklch(0.95 0.02 328)",

		// Primary - the hero pink, full saturation
		primary: "oklch(0.75 0.26 328)",
		primaryForeground: "oklch(0.08 0.02 328)",

		// Secondary - desaturated pink
		secondary: "oklch(0.20 0.06 328)",
		secondaryForeground: "oklch(0.90 0.08 328)",

		// Muted - subtle pink tint
		muted: "oklch(0.18 0.04 328)",
		mutedForeground: "oklch(0.65 0.10 328)",

		// Accent - mid-bright pink for highlights
		accent: "oklch(0.25 0.08 328)",
		accentForeground: "oklch(0.92 0.06 328)",

		// Tertiary - panel toolbars with pink tint
		tertiary: "oklch(0.10 0.03 328)",
		tertiaryActive: "oklch(0.16 0.05 328)",

		// Destructive - shifted toward red-pink
		destructive: "oklch(0.45 0.20 350)",
		destructiveForeground: "oklch(0.90 0.15 350)",

		// Borders and inputs - glowing pink edges
		border: "oklch(0.28 0.10 328)",
		input: "oklch(0.22 0.08 328)",
		ring: "oklch(0.75 0.26 328)",

		// Sidebar - darker with pink accents
		sidebar: "oklch(0.10 0.025 328)",
		sidebarForeground: "oklch(0.92 0.04 328)",
		sidebarPrimary: "oklch(0.75 0.26 328)",
		sidebarPrimaryForeground: "oklch(0.08 0.02 328)",
		sidebarAccent: "oklch(0.22 0.07 328)",
		sidebarAccentForeground: "oklch(0.92 0.04 328)",
		sidebarBorder: "oklch(0.25 0.08 328)",
		sidebarRing: "oklch(0.75 0.26 328)",

		// Charts - monochromatic pink spectrum
		chart1: "oklch(0.75 0.26 328)", // Primary pink
		chart2: "oklch(0.65 0.22 320)", // Deeper magenta
		chart3: "oklch(0.55 0.18 335)", // Muted rose
		chart4: "oklch(0.80 0.20 315)", // Light orchid
		chart5: "oklch(0.45 0.15 340)", // Dark fuschia
	},

	terminal: {
		background: "#0d0810",
		foreground: "#f5e8f3",
		cursor: "#ff7aed",
		cursorAccent: "#0d0810",
		selectionBackground: "rgba(255, 122, 237, 0.25)",

		// ANSI colors - pink-shifted palette
		black: "#0d0810",
		red: "#ff4d8d",
		green: "#ff7aed", // Use pink for success
		yellow: "#ffaaee",
		blue: "#d87aff",
		magenta: "#ff7aed",
		cyan: "#ffb8f5",
		white: "#f5e8f3",

		// Bright ANSI colors
		brightBlack: "#3d2a38",
		brightRed: "#ff6b9e",
		brightGreen: "#ff99f0",
		brightYellow: "#ffccf5",
		brightBlue: "#e599ff",
		brightMagenta: "#ff99f0",
		brightCyan: "#ffd6f9",
		brightWhite: "#ffffff",
	},
};
