import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface DashboardModalState {
	isOpen: boolean;
	openModal: () => void;
	closeModal: () => void;
	toggleModal: () => void;
}

export const useDashboardModalStore = create<DashboardModalState>()(
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
		{ name: "DashboardModalStore" },
	),
);

// Convenience hooks
export const useDashboardModalOpen = () => useDashboardModalStore((state) => state.isOpen);
export const useOpenDashboardModal = () => useDashboardModalStore((state) => state.openModal);
export const useCloseDashboardModal = () => useDashboardModalStore((state) => state.closeModal);
export const useToggleDashboardModal = () => useDashboardModalStore((state) => state.toggleModal);
