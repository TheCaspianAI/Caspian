import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Settings sections available in the modal.
 */
export type SettingsSection = "appearance" | "preferences" | "presets" | "sessions" | "repository";

interface SettingsState {
	activeSection: SettingsSection;
	searchQuery: string;
	isOpen: boolean;

	setActiveSection: (section: SettingsSection) => void;
	setSearchQuery: (query: string) => void;
	openSettings: (section?: SettingsSection) => void;
	closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
	devtools(
		(set) => ({
			activeSection: "appearance",
			searchQuery: "",
			isOpen: false,

			setActiveSection: (section) => set({ activeSection: section }),

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
export const useSettingsSection = () => useSettingsStore((state) => state.activeSection);
export const useSetSettingsSection = () => useSettingsStore((state) => state.setActiveSection);
export const useSettingsSearchQuery = () => useSettingsStore((state) => state.searchQuery);
export const useSetSettingsSearchQuery = () => useSettingsStore((state) => state.setSearchQuery);
export const useCloseSettings = () => useSettingsStore((state) => state.closeSettings);
export const useOpenSettings = () => useSettingsStore((state) => state.openSettings);
export const useSettingsIsOpen = () => useSettingsStore((state) => state.isOpen);
