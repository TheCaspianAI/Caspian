import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface ConfigModalState {
	isOpen: boolean;
	repositoryId: string | null;
	openModal: (repositoryId: string) => void;
	closeModal: () => void;
}

export const useConfigModalStore = create<ConfigModalState>()(
	devtools(
		(set) => ({
			isOpen: false,
			repositoryId: null,

			openModal: (repositoryId) => {
				set({ isOpen: true, repositoryId });
			},

			closeModal: () => {
				set({ isOpen: false, repositoryId: null });
			},
		}),
		{ name: "ConfigModalStore" },
	),
);

// Convenience hooks
export const useConfigModalOpen = () =>
	useConfigModalStore((state) => state.isOpen);
export const useConfigModalRepositoryId = () =>
	useConfigModalStore((state) => state.repositoryId);
export const useOpenConfigModal = () =>
	useConfigModalStore((state) => state.openModal);
export const useCloseConfigModal = () =>
	useConfigModalStore((state) => state.closeModal);
