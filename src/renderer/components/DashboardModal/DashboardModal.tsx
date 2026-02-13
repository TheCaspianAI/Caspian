import { useCloseDashboardModal, useDashboardModalOpen } from "renderer/stores/dashboard-modal";
import { DashboardContent } from "./DashboardContent";

export function DashboardModal() {
	const isOpen = useDashboardModalOpen();
	const closeModal = useCloseDashboardModal();

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop with blur */}
			<button
				type="button"
				className="absolute inset-0 bg-black/60 animate-in fade-in-0 duration-200"
				onClick={closeModal}
				onKeyDown={(e) => e.key === "Escape" && closeModal()}
				tabIndex={0}
				aria-label="Close modal"
			/>
			{/* Modal content */}
			<div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] max-w-[85vw] max-h-[85vh] overflow-hidden rounded-[10px] surface-raised bg-card animate-in fade-in-0 duration-200 flex flex-col">
				<DashboardContent onClose={closeModal} />
			</div>
		</div>
	);
}
