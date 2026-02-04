import type { Theme } from "../types";
import { caspianTheme } from "./caspian";
import { everforestTheme } from "./everforest";
import { githubDarkTheme } from "./github-dark";
import { githubLightTheme } from "./github-light";
import { nordTheme } from "./nord";
import { rosePineTheme } from "./rose-pine";

/**
 * All built-in themes
 */
export const builtInThemes: Theme[] = [
	caspianTheme,
	nordTheme,
	githubDarkTheme,
	githubLightTheme,
	rosePineTheme,
	everforestTheme,
];

/**
 * Default theme ID - Caspian is the gold-standard reference theme
 */
export const DEFAULT_THEME_ID = "caspian";

/**
 * Get a built-in theme by ID
 */
export function getBuiltInTheme(id: string): Theme | undefined {
	return builtInThemes.find((theme) => theme.id === id);
}

// Re-export individual themes
export {
	caspianTheme,
	everforestTheme,
	githubDarkTheme,
	githubLightTheme,
	nordTheme,
	rosePineTheme,
};
