import { useEffect } from "react";
import {
	useCloseNodeSwitcherModal,
	useNodeSwitcherModalOpen,
} from "renderer/stores/node-switcher-modal";
import { NodeSwitcherContent } from "./NodeSwitcherContent";

export function NodeSwitcherModal() {
	const isOpen = useNodeSwitcherModalOpen();
	const closeModal = useCloseNodeSwitcherModal();

	// Handle Escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				closeModal();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeModal]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop with blur */}
			<button
				type="button"
				className="absolute inset-0 bg-black/60"
				onClick={closeModal}
				onKeyDown={(e) => e.key === "Escape" && closeModal()}
				tabIndex={0}
				aria-label="Close modal"
			/>
			{/* Modal content */}
			<div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-[540px] max-h-[70vh] overflow-hidden rounded-[10px] surface-raised bg-background">
				<NodeSwitcherContent />
			</div>
		</div>
	);
}
