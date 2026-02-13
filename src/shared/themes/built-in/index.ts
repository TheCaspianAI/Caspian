import type { Theme } from "../types";
import { everforestTheme } from "./everforest";
import { githubDarkTheme } from "./github-dark";
import { githubLightTheme } from "./github-light";
import { graceTheme } from "./grace";
import { hexTheme } from "./hex";
import { rosePineTheme } from "./rose-pine";

/**
 * All built-in themes
 */
export const builtInThemes: Theme[] = [
	graceTheme,
	hexTheme,
	githubDarkTheme,
	githubLightTheme,
	rosePineTheme,
	everforestTheme,
];

/**
 * Default theme ID - Grace is the default reference theme
 */
export const DEFAULT_THEME_ID = "grace";

/**
 * Get a built-in theme by ID
 */
export function getBuiltInTheme(id: string): Theme | undefined {
	return builtInThemes.find((theme) => theme.id === id);
}

// Re-export individual themes
export { graceTheme, everforestTheme, githubDarkTheme, githubLightTheme, hexTheme, rosePineTheme };
