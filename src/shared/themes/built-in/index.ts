import type { Theme } from "../types";
import { catppuccinTheme } from "./catppuccin";
import { draculaTheme } from "./dracula";
import { githubLightTheme } from "./github-light";
import { gruvboxTheme } from "./gruvbox";
import { nordTheme } from "./nord";
import { rosePineTheme } from "./rose-pine";
import { solarizedTheme } from "./solarized";
import { tokyoNightTheme } from "./tokyo-night";

/**
 * All built-in themes
 */
export const builtInThemes: Theme[] = [
	draculaTheme,
	nordTheme,
	catppuccinTheme,
	tokyoNightTheme,
	gruvboxTheme,
	rosePineTheme,
	solarizedTheme,
	githubLightTheme,
];

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = "dracula";

/**
 * Get a built-in theme by ID
 */
export function getBuiltInTheme(id: string): Theme | undefined {
	return builtInThemes.find((theme) => theme.id === id);
}

// Re-export individual themes
export {
	catppuccinTheme,
	draculaTheme,
	githubLightTheme,
	gruvboxTheme,
	nordTheme,
	rosePineTheme,
	solarizedTheme,
	tokyoNightTheme,
};
