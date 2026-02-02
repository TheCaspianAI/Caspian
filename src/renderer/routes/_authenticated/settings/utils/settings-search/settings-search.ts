import type { SettingsSection } from "renderer/stores/settings-state";

export const SETTING_ITEM_ID = {
	APPEARANCE_THEME: "appearance-theme",
	APPEARANCE_MARKDOWN: "appearance-markdown",
	APPEARANCE_CUSTOM_THEMES: "appearance-custom-themes",

	RINGTONES_NOTIFICATION: "ringtones-notification",

	KEYBOARD_SHORTCUTS: "keyboard-shortcuts",

	BEHAVIOR_CONFIRM_QUIT: "behavior-confirm-quit",
	BEHAVIOR_BRANCH_PREFIX: "behavior-branch-prefix",

	TERMINAL_PRESETS: "terminal-presets",
	TERMINAL_QUICK_ADD: "terminal-quick-add",
	TERMINAL_AUTO_APPLY_PRESET: "terminal-auto-apply-preset",
	TERMINAL_SESSIONS: "terminal-sessions",
	TERMINAL_LINK_BEHAVIOR: "terminal-link-behavior",

	PROJECT_NAME: "project-name",
	PROJECT_PATH: "project-path",
	PROJECT_SCRIPTS: "project-scripts",
	PROJECT_BRANCH_PREFIX: "project-branch-prefix",

	WORKSPACE_NAME: "workspace-name",
	WORKSPACE_BRANCH: "workspace-branch",
	WORKSPACE_PATH: "workspace-path",
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
	{
		id: SETTING_ITEM_ID.RINGTONES_NOTIFICATION,
		section: "ringtones",
		title: "Notification Sound",
		description: "Choose the notification sound for completed tasks",
		keywords: [
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
		id: SETTING_ITEM_ID.KEYBOARD_SHORTCUTS,
		section: "keyboard",
		title: "Keyboard Shortcuts",
		description: "View and customize keyboard shortcuts",
		keywords: [
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
		id: SETTING_ITEM_ID.BEHAVIOR_CONFIRM_QUIT,
		section: "behavior",
		title: "Confirm before quitting",
		description: "Show a confirmation dialog when quitting the app",
		keywords: [
			"features",
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
		id: SETTING_ITEM_ID.BEHAVIOR_BRANCH_PREFIX,
		section: "behavior",
		title: "Branch Prefix",
		description: "Default prefix for new branch names",
		keywords: [
			"features",
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
		id: SETTING_ITEM_ID.TERMINAL_PRESETS,
		section: "terminal",
		title: "Terminal Presets",
		description: "Manage your terminal presets",
		keywords: [
			"terminal",
			"preset",
			"presets",
			"commands",
			"agent",
			"launch",
			"default",
			"startup",
			"config",
			"shell",
			"run",
		],
	},
	{
		id: SETTING_ITEM_ID.TERMINAL_QUICK_ADD,
		section: "terminal",
		title: "Quick Add Templates",
		description: "Pre-configured terminal presets",
		keywords: [
			"terminal",
			"quick",
			"add",
			"template",
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
		id: SETTING_ITEM_ID.TERMINAL_AUTO_APPLY_PRESET,
		section: "terminal",
		title: "Auto-apply Default Preset",
		description: "Automatically apply default preset when creating workspaces",
		keywords: [
			"terminal",
			"preset",
			"default",
			"auto",
			"apply",
			"workspace",
			"create",
			"new",
			"startup",
			"launch",
		],
	},
	{
		id: SETTING_ITEM_ID.TERMINAL_SESSIONS,
		section: "terminal",
		title: "Active Sessions",
		description: "View and manage active terminal sessions",
		keywords: [
			"terminal",
			"sessions",
			"active",
			"running",
			"kill",
			"terminate",
			"process",
			"stop",
			"manage",
			"pty",
		],
	},
	{
		id: SETTING_ITEM_ID.TERMINAL_LINK_BEHAVIOR,
		section: "terminal",
		title: "Link Behavior",
		description: "How to open links from terminal",
		keywords: [
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
	{
		id: SETTING_ITEM_ID.PROJECT_NAME,
		section: "project",
		title: "Project Name",
		description: "The name of this project",
		keywords: ["project", "name", "rename", "title", "label"],
	},
	{
		id: SETTING_ITEM_ID.PROJECT_PATH,
		section: "project",
		title: "Repository Path",
		description: "The file path to this project",
		keywords: [
			"project",
			"path",
			"repository",
			"folder",
			"directory",
			"location",
			"git",
			"repo",
			"root",
		],
	},
	{
		id: SETTING_ITEM_ID.PROJECT_SCRIPTS,
		section: "project",
		title: "Scripts",
		description: "Setup and teardown scripts for workspaces",
		keywords: [
			"project",
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
		id: SETTING_ITEM_ID.PROJECT_BRANCH_PREFIX,
		section: "project",
		title: "Branch Prefix",
		description: "Override the default branch prefix for this project",
		keywords: [
			"project",
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
	{
		id: SETTING_ITEM_ID.WORKSPACE_NAME,
		section: "workspace",
		title: "Workspace Name",
		description: "The name of this workspace",
		keywords: ["workspace", "name", "rename", "title", "label"],
	},
	{
		id: SETTING_ITEM_ID.WORKSPACE_BRANCH,
		section: "workspace",
		title: "Branch",
		description: "The git branch for this workspace",
		keywords: [
			"workspace",
			"branch",
			"git",
			"worktree",
			"checkout",
			"switch",
			"feature",
		],
	},
	{
		id: SETTING_ITEM_ID.WORKSPACE_PATH,
		section: "workspace",
		title: "File Path",
		description: "The file path to this workspace",
		keywords: ["workspace", "path", "folder", "directory", "location", "root"],
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
