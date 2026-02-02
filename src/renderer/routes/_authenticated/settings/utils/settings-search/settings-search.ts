import type { SettingsSection } from "renderer/stores/settings-state";

export const SETTING_ITEM_ID = {
	APPEARANCE_THEME: "appearance-theme",
	APPEARANCE_MARKDOWN: "appearance-markdown",
	APPEARANCE_CUSTOM_THEMES: "appearance-custom-themes",

	// Preferences (consolidated section)
	PREFERENCES_NOTIFICATION_SOUND: "preferences-notification-sound",
	PREFERENCES_KEYBOARD_SHORTCUTS: "preferences-keyboard-shortcuts",
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

	// Repository (was project)
	REPOSITORY_NAME: "repository-name",
	REPOSITORY_PATH: "repository-path",
	REPOSITORY_SCRIPTS: "repository-scripts",
	REPOSITORY_BRANCH_PREFIX: "repository-branch-prefix",

	// Node (was workspace)
	NODE_NAME: "node-name",
	NODE_BRANCH: "node-branch",
	NODE_PATH: "node-path",

	// Legacy aliases for backward compatibility
	RINGTONES_NOTIFICATION: "preferences-notification-sound",
	KEYBOARD_SHORTCUTS: "preferences-keyboard-shortcuts",
	BEHAVIOR_CONFIRM_QUIT: "preferences-confirm-quit",
	BEHAVIOR_BRANCH_PREFIX: "preferences-branch-prefix",
	TERMINAL_PRESETS: "presets-list",
	TERMINAL_QUICK_ADD: "presets-agent-templates",
	TERMINAL_AUTO_APPLY_PRESET: "presets-auto-apply",
	TERMINAL_SESSIONS: "sessions-active",
	TERMINAL_LINK_BEHAVIOR: "preferences-link-behavior",
	PROJECT_NAME: "repository-name",
	PROJECT_PATH: "repository-path",
	PROJECT_SCRIPTS: "repository-scripts",
	PROJECT_BRANCH_PREFIX: "repository-branch-prefix",
	WORKSPACE_NAME: "node-name",
	WORKSPACE_BRANCH: "node-branch",
	WORKSPACE_PATH: "node-path",
} as const;

export type SettingItemId =
	(typeof SETTING_ITEM_ID)[keyof typeof SETTING_ITEM_ID];

export interface SettingsItem {
	id: SettingItemId;
	section: SettingsSection;
	title: string;
	description: string;
	keywords: string[];
}

export const SETTINGS_ITEMS: SettingsItem[] = [
	// Appearance
	{
		id: SETTING_ITEM_ID.APPEARANCE_THEME,
		section: "appearance",
		title: "Theme",
		description: "Choose your theme",
		keywords: [
			"appearance",
			"theme",
			"dark",
			"light",
			"dark mode",
			"light mode",
			"colors",
			"night",
			"system",
			"visual",
		],
	},
	{
		id: SETTING_ITEM_ID.APPEARANCE_MARKDOWN,
		section: "appearance",
		title: "Markdown Style",
		description: "Rendering style for markdown files",
		keywords: [
			"appearance",
			"markdown",
			"style",
			"tufte",
			"rendering",
			"preview",
			"format",
			"display",
			"md",
			"readme",
		],
	},
	{
		id: SETTING_ITEM_ID.APPEARANCE_CUSTOM_THEMES,
		section: "appearance",
		title: "Custom Themes",
		description: "Import custom theme files",
		keywords: [
			"appearance",
			"custom",
			"themes",
			"import",
			"json",
			"color scheme",
			"upload",
			"personalize",
			"customize",
		],
	},

	// Preferences
	{
		id: SETTING_ITEM_ID.PREFERENCES_NOTIFICATION_SOUND,
		section: "preferences",
		title: "Notification Sound",
		description: "Choose the notification sound for completed tasks",
		keywords: [
			"preferences",
			"notifications",
			"notification",
			"sound",
			"ringtone",
			"audio",
			"alert",
			"bell",
			"tone",
			"complete",
			"done",
			"finished",
			"chime",
			"mute",
			"volume",
		],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_KEYBOARD_SHORTCUTS,
		section: "preferences",
		title: "Keyboard Shortcuts",
		description: "View and customize keyboard shortcuts",
		keywords: [
			"preferences",
			"keyboard",
			"shortcuts",
			"hotkeys",
			"keys",
			"bindings",
			"keybindings",
			"commands",
			"ctrl",
			"cmd",
			"alt",
			"customize",
		],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_CONFIRM_QUIT,
		section: "preferences",
		title: "Confirm before quitting",
		description: "Show a confirmation dialog when quitting the app",
		keywords: [
			"preferences",
			"confirm",
			"quit",
			"quitting",
			"exit",
			"close",
			"dialog",
			"warning",
			"prompt",
			"unsaved",
		],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_BRANCH_PREFIX,
		section: "preferences",
		title: "Branch Prefix",
		description: "Default prefix for new branch names",
		keywords: [
			"preferences",
			"branch",
			"prefix",
			"naming",
			"git",
			"worktree",
			"author",
			"github",
			"username",
			"feat",
			"custom",
		],
	},
	{
		id: SETTING_ITEM_ID.PREFERENCES_LINK_BEHAVIOR,
		section: "preferences",
		title: "Terminal Link Behavior",
		description: "How to open file links from terminal",
		keywords: [
			"preferences",
			"terminal",
			"link",
			"click",
			"open",
			"external",
			"editor",
			"file",
			"url",
			"path",
			"cmd",
			"ctrl",
			"browser",
		],
	},

	// Presets
	{
		id: SETTING_ITEM_ID.PRESETS_LIST,
		section: "presets",
		title: "Execution Presets",
		description: "Manage execution configurations for AI coding agents",
		keywords: [
			"presets",
			"terminal",
			"preset",
			"commands",
			"agent",
			"launch",
			"default",
			"startup",
			"config",
			"shell",
			"run",
			"execution",
		],
	},
	{
		id: SETTING_ITEM_ID.PRESETS_AGENT_TEMPLATES,
		section: "presets",
		title: "Agent Templates",
		description: "Pre-configured presets for popular AI agents",
		keywords: [
			"presets",
			"agent",
			"templates",
			"quick",
			"add",
			"claude",
			"codex",
			"gemini",
			"cursor",
			"opencode",
			"ai",
			"assistant",
		],
	},
	{
		id: SETTING_ITEM_ID.PRESETS_AUTO_APPLY,
		section: "presets",
		title: "Auto-apply Default Preset",
		description: "Automatically apply default preset when creating nodes",
		keywords: [
			"presets",
			"preset",
			"default",
			"auto",
			"apply",
			"node",
			"create",
			"new",
			"startup",
			"launch",
		],
	},

	// Sessions
	{
		id: SETTING_ITEM_ID.SESSIONS_ACTIVE,
		section: "sessions",
		title: "Active Sessions",
		description: "View and manage active agent sessions",
		keywords: [
			"sessions",
			"active",
			"running",
			"terminal",
			"process",
			"agent",
			"daemon",
			"pty",
		],
	},
	{
		id: SETTING_ITEM_ID.SESSIONS_CONTROLS,
		section: "sessions",
		title: "Session Controls",
		description: "Kill sessions, clear history, restart daemon",
		keywords: [
			"sessions",
			"controls",
			"kill",
			"terminate",
			"stop",
			"clear",
			"history",
			"restart",
			"daemon",
			"manage",
		],
	},

	// Repository
	{
		id: SETTING_ITEM_ID.REPOSITORY_NAME,
		section: "repository",
		title: "Repository Name",
		description: "The name of this repository",
		keywords: ["repository", "name", "rename", "title", "label", "project"],
	},
	{
		id: SETTING_ITEM_ID.REPOSITORY_PATH,
		section: "repository",
		title: "Repository Path",
		description: "The file path to this repository",
		keywords: [
			"repository",
			"path",
			"folder",
			"directory",
			"location",
			"git",
			"repo",
			"root",
			"project",
		],
	},
	{
		id: SETTING_ITEM_ID.REPOSITORY_SCRIPTS,
		section: "repository",
		title: "Scripts",
		description: "Setup and teardown scripts for nodes",
		keywords: [
			"repository",
			"scripts",
			"setup",
			"teardown",
			"bash",
			"shell",
			"automation",
			"hooks",
			"init",
			"initialize",
			"cleanup",
			"onboarding",
			"config",
		],
	},
	{
		id: SETTING_ITEM_ID.REPOSITORY_BRANCH_PREFIX,
		section: "repository",
		title: "Branch Prefix",
		description: "Override the default branch prefix for this repository",
		keywords: [
			"repository",
			"branch",
			"prefix",
			"naming",
			"git",
			"worktree",
			"author",
			"github",
			"username",
			"feat",
			"custom",
			"override",
		],
	},

	// Node
	{
		id: SETTING_ITEM_ID.NODE_NAME,
		section: "node",
		title: "Node Name",
		description: "The name of this node",
		keywords: ["node", "name", "rename", "title", "label", "workspace"],
	},
	{
		id: SETTING_ITEM_ID.NODE_BRANCH,
		section: "node",
		title: "Branch",
		description: "The git branch for this node",
		keywords: [
			"node",
			"branch",
			"git",
			"worktree",
			"checkout",
			"switch",
			"feature",
		],
	},
	{
		id: SETTING_ITEM_ID.NODE_PATH,
		section: "node",
		title: "File Path",
		description: "The file path to this node",
		keywords: ["node", "path", "folder", "directory", "location", "root"],
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

export function getMatchCountBySection(
	query: string,
): Partial<Record<SettingsSection, number>> {
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
