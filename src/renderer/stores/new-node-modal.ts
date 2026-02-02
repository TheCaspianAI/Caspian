import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NewNodeModalState {
	isOpen: boolean;
	preSelectedRepositoryId: string | null;
	openModal: (repositoryId?: string) => void;
	closeModal: () => void;
}

export const useNewNodeModalStore = create<NewNodeModalState>()(
	devtools(
		(set) => ({
			isOpen: false,
			preSelectedRepositoryId: null,

			openModal: (repositoryId?: string) => {
				set({ isOpen: true, preSelectedRepositoryId: repositoryId ?? null });
			},

			closeModal: () => {
				set({ isOpen: false, preSelectedRepositoryId: null });
			},
		}),
		{ name: "NewNodeModalStore" },
	),
);

// Convenience hooks
export const useNewNodeModalOpen = () =>
	useNewNodeModalStore((state) => state.isOpen);
export const useOpenNewNodeModal = () =>
	useNewNodeModalStore((state) => state.openModal);
export const useCloseNewNodeModal = () =>
	useNewNodeModalStore((state) => state.closeModal);
export const usePreSelectedRepositoryId = () =>
	useNewNodeModalStore((state) => state.preSelectedRepositoryId);
