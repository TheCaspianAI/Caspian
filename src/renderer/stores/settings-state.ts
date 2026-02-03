import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Settings sections available in the settings view.
 * General sections are the main categories, repository/node are dynamic.
 */
export type SettingsSection =
	| "appearance"
	| "preferences"   // main preferences page
	| "keyboard"      // keyboard shortcuts
	| "behavior"      // general behavior settings
	| "presets"       // terminal presets
	| "terminal"      // terminal settings page
	| "sessions"      // terminal sessions
	| "repository"    // was project
	| "node";         // was workspace

interface SettingsState {
	activeSection: SettingsSection;
	activeRepositoryId: string | null;
	activeNodeId: string | null;
	searchQuery: string;
	isOpen: boolean;

	setActiveSection: (section: SettingsSection) => void;
	setActiveRepository: (repositoryId: string | null) => void;
	setActiveNode: (nodeId: string | null) => void;
	setSearchQuery: (query: string) => void;
	openSettings: (section?: SettingsSection) => void;
	closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
	devtools(
		(set) => ({
			activeSection: "appearance",
			activeRepositoryId: null,
			activeNodeId: null,
			searchQuery: "",
			isOpen: false,

			setActiveSection: (section) => set({ activeSection: section }),

			setActiveRepository: (repositoryId) =>
				set({
					activeRepositoryId: repositoryId,
					activeNodeId: null,
					activeSection: "repository",
				}),

			setActiveNode: (nodeId) =>
				set({
					activeNodeId: nodeId,
					activeSection: "node",
				}),

			setSearchQuery: (query) => set({ searchQuery: query }),

			openSettings: (section) =>
				set({
					isOpen: true,
					activeSection: section ?? "appearance",
				}),

			closeSettings: () =>
				set({
					isOpen: false,
					searchQuery: "",
				}),
		}),
		{ name: "SettingsStore" },
	),
);

// Convenience hooks
export const useSettingsSection = () =>
	useSettingsStore((state) => state.activeSection);
export const useSetSettingsSection = () =>
	useSettingsStore((state) => state.setActiveSection);
export const useSettingsSearchQuery = () =>
	useSettingsStore((state) => state.searchQuery);
export const useSetSettingsSearchQuery = () =>
	useSettingsStore((state) => state.setSearchQuery);
export const useActiveRepositoryId = () =>
	useSettingsStore((state) => state.activeRepositoryId);
export const useActiveNodeId = () =>
	useSettingsStore((state) => state.activeNodeId);
export const useCloseSettings = () =>
	useSettingsStore((state) => state.closeSettings);
