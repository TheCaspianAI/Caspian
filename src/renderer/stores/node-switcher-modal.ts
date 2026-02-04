import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NodeSwitcherModalState {
	isOpen: boolean;
	openModal: () => void;
	closeModal: () => void;
	toggleModal: () => void;
}

export const useNodeSwitcherModalStore = create<NodeSwitcherModalState>()(
	devtools(
		(set) => ({
			isOpen: false,

			openModal: () => {
				set({ isOpen: true });
			},

			closeModal: () => {
				set({ isOpen: false });
			},

			toggleModal: () => {
				set((state) => ({ isOpen: !state.isOpen }));
			},
		}),
		{ name: "NodeSwitcherModalStore" },
	),
);

// Convenience hooks
export const useNodeSwitcherModalOpen = () => useNodeSwitcherModalStore((state) => state.isOpen);
export const useOpenNodeSwitcherModal = () => useNodeSwitcherModalStore((state) => state.openModal);
export const useCloseNodeSwitcherModal = () =>
	useNodeSwitcherModalStore((state) => state.closeModal);
export const useToggleNodeSwitcherModal = () =>
	useNodeSwitcherModalStore((state) => state.toggleModal);
