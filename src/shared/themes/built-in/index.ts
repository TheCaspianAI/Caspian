import type { Theme } from "../types";
import { darkTheme } from "./dark";
import { emberTheme } from "./ember";
import { lightTheme } from "./light";
import { monokaiTheme } from "./monokai";
import { neonTheme } from "./neon";
import { oneDarkTheme } from "./one-dark";

/**
 * All built-in themes
 */
export const builtInThemes: Theme[] = [
	neonTheme,
	darkTheme,
	lightTheme,
	emberTheme,
	monokaiTheme,
	oneDarkTheme,
];

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = "neon";

/**
 * Get a built-in theme by ID
 */
export function getBuiltInTheme(id: string): Theme | undefined {
	return builtInThemes.find((theme) => theme.id === id);
}

// Re-export individual themes
export {
	darkTheme,
	emberTheme,
	lightTheme,
	monokaiTheme,
	neonTheme,
	oneDarkTheme,
};
