import { useSettingsStore } from "renderer/stores/settings-state";
import { SettingsContent } from "./SettingsContent";
import { useEffect } from "react";

export function SettingsModal() {
	const isOpen = useSettingsStore((s) => s.isOpen);
	const closeSettings = useSettingsStore((s) => s.closeSettings);

	// Handle Escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				closeSettings();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeSettings]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop with blur */}
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={closeSettings}
			/>
			{/* Modal content */}
			<div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl elevation-3 bg-background flex flex-col">
				<SettingsContent onClose={closeSettings} />
			</div>
		</div>
	);
}
