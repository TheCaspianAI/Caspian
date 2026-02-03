import {
	useDashboardModalOpen,
	useCloseDashboardModal,
} from "renderer/stores/dashboard-modal";
import { DashboardContent } from "./DashboardContent";

export function DashboardModal() {
	const isOpen = useDashboardModalOpen();
	const closeModal = useCloseDashboardModal();

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop with blur */}
			<div
				className="absolute inset-0 bg-black/40 modal-backdrop-blur animate-in fade-in duration-150"
				onClick={closeModal}
			/>
			{/* Modal content */}
			<div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[85vw] max-w-[1600px] h-[85vh] overflow-hidden rounded-xl elevation-3 bg-background animate-in fade-in slide-in-from-bottom-4 duration-150">
				<DashboardContent onClose={closeModal} />
			</div>
		</div>
	);
}
