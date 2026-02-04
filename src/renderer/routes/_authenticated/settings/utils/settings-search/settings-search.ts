import type { SettingsSection } from "renderer/stores/settings-state";

export const SETTING_ITEM_ID = {
	// Appearance
	APPEARANCE_THEME: "appearance-theme",
	APPEARANCE_MARKDOWN: "appearance-markdown",
	APPEARANCE_CUSTOM_THEMES: "appearance-custom-themes",

	// Preferences
	PREFERENCES_NOTIFICATIONS: "preferences-notifications",
	PREFERENCES_KEYBOARD: "preferences-keyboard",
	PREFERENCES_CONFIRM_QUIT: "preferences-confirm-quit",
	PREFERENCES_BRANCH_PREFIX: "preferences-branch-prefix",
	PREFERENCES_LINK_BEHAVIOR: "preferences-link-behavior",

	// Presets
	PRESETS_LIST: "presets-list",
	PRESETS_AGENT_TEMPLATES: "presets-agent-templates",
	PRESETS_AUTO_APPLY: "presets-auto-apply",

	// Sessions
	SESSIONS_ACTIVE: "sessions-active",
	SESSIONS_CONTROLS: "sessions-controls",

	// Repository
	REPOSITORY_NAME: "repository-name",
	REPOSITORY_PATH: "repository-path",
	REPOSITORY_BRANCH_PREFIX: "repository-branch-prefix",
} as const;

export type SettingItemId = (typeof SETTING_ITEM_ID)[keyof typeof SETTING_ITEM_ID];

export interface SettingsItem {
	id: SettingItemId;
	section: SettingsSection;
	title: string;
	description: string;
	keywords: string[];
}

export const SETTINGS_ITEMS: SettingsItem[] = [
	// Appearance section
	{
		id: SETTING_ITEM_ID.APPEARANCE_THEME,
		section: "appearance",
		title: "Interface Theme",
		description: "Select a color theme for the interface",
		keywords: ["appearance", "theme", "dark", "light", "colors", "visual", "night", "system"],
	},
	{
		id: SETTING_ITEM_ID.APPEARANCE_MARKDOWN,
		section: "appearance",
		title: "Markdown Rendering",
		description: "Configure how markdown content is displayed",
		keywords: ["appearance", "markdown", "style", "tufte", "rendering", "preview", "format"],
	},
	{
		id: SETTING_ITEM_ID.APPEARANCE_CUSTOM_THEMES,
		section: "appearance",
		title: "Custom Themes",
		description: "Import custom theme files",
		keywords: ["appearance", "custom", "themes", "import", "json", "color scheme"],
	},

	// Preferences section
	{
		id: SETTING_ITEM_ID.PREFERENCES_NOTIFICATIONS,
		section: "preferences",
		title: "Notification Sounds",
		description: "Enable audio notifications for completed operations",
		keywords: ["preferences", "notification", "sound", "audio", "alert", "bell", "mute"],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_KEYBOARD,
		section: "preferences",
		title: "Keyboard Shortcuts",
		description: "View and customize keyboard shortcuts",
		keywords: ["preferences", "keyboard", "shortcuts", "hotkeys", "bindings", "keybindings"],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_CONFIRM_QUIT,
		section: "preferences",
		title: "Confirm Before Quitting",
		description: "Require confirmation before closing the application",
		keywords: ["preferences", "confirm", "quit", "exit", "close", "dialog"],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_BRANCH_PREFIX,
		section: "preferences",
		title: "Branch Prefix",
		description: "Configure branch naming conventions for new nodes",
		keywords: ["preferences", "branch", "prefix", "naming", "git"],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_LINK_BEHAVIOR,
		section: "preferences",
		title: "Link Handling",
		description: "Configure how file paths are opened from terminal",
		keywords: ["preferences", "link", "click", "open", "editor", "file", "path"],
	},

	// Presets section
	{
		id: SETTING_ITEM_ID.PRESETS_LIST,
		section: "presets",
		title: "Execution Presets",
		description: "Manage your execution presets for AI agents",
		keywords: ["presets", "terminal", "commands", "agent", "launch", "startup", "config"],
	},
	{
		id: SETTING_ITEM_ID.PRESETS_AGENT_TEMPLATES,
		section: "presets",
		title: "Agent Templates",
		description: "Pre-configured presets for popular AI coding agents",
		keywords: ["presets", "template", "claude", "codex", "gemini", "cursor", "ai", "assistant"],
	},
	{
		id: SETTING_ITEM_ID.PRESETS_AUTO_APPLY,
		section: "presets",
		title: "Auto-apply Default Preset",
		description: "Automatically apply default preset when creating nodes",
		keywords: ["presets", "default", "auto", "apply", "create", "startup"],
	},

	// Sessions section
	{
		id: SETTING_ITEM_ID.SESSIONS_ACTIVE,
		section: "sessions",
		title: "Active Sessions",
		description: "View and manage active agent sessions",
		keywords: ["sessions", "active", "running", "process", "terminal", "pty"],
	},
	{
		id: SETTING_ITEM_ID.SESSIONS_CONTROLS,
		section: "sessions",
		title: "Session Controls",
		description: "Kill sessions, clear history, restart daemon",
		keywords: ["sessions", "kill", "terminate", "stop", "clear", "restart", "daemon"],
	},

	// Repository section
	{
		id: SETTING_ITEM_ID.REPOSITORY_NAME,
		section: "repository",
		title: "Repository Name",
		description: "Display name for this repository",
		keywords: ["repository", "name", "rename", "title", "label"],
	},
	{
		id: SETTING_ITEM_ID.REPOSITORY_PATH,
		section: "repository",
		title: "Repository Path",
		description: "Local filesystem path to this repository",
		keywords: ["repository", "path", "folder", "directory", "location", "git", "root"],
	},
	{
		id: SETTING_ITEM_ID.REPOSITORY_BRANCH_PREFIX,
		section: "repository",
		title: "Branch Prefix Override",
		description: "Override the default branch prefix for this repository",
		keywords: ["repository", "branch", "prefix", "naming", "git", "override"],
	},
];

export function searchSettings(query: string): SettingsItem[] {
	if (!query.trim()) return SETTINGS_ITEMS;

	const q = query.toLowerCase();
	return SETTINGS_ITEMS.filter(
		(item) =>
			item.title.toLowerCase().includes(q) ||
			item.description.toLowerCase().includes(q) ||
			item.keywords.some((kw) => kw.toLowerCase().includes(q)),
	);
}

export function getMatchCountBySection(query: string): Partial<Record<SettingsSection, number>> {
	const matches = searchSettings(query);
	const counts: Partial<Record<SettingsSection, number>> = {};

	for (const item of matches) {
		counts[item.section] = (counts[item.section] || 0) + 1;
	}

	return counts;
}

export function getMatchingItemsForSection(
	query: string,
	section: SettingsSection,
): SettingsItem[] {
	return searchSettings(query).filter((item) => item.section === section);
}

export function isItemVisible(
	itemId: SettingItemId,
	visibleItems: SettingItemId[] | null | undefined,
): boolean {
	return !visibleItems || visibleItems.includes(itemId);
}
