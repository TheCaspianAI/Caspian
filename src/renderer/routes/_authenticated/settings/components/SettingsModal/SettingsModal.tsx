import { useEffect, useRef } from "react";
import { cn } from "ui/lib/utils";
import { useSettingsStore } from "renderer/stores/settings-state";

interface SettingsModalProps {
	children: React.ReactNode;
}

export function SettingsModal({ children }: SettingsModalProps) {
	const isOpen = useSettingsStore((s) => s.isOpen);
	const closeSettings = useSettingsStore((s) => s.closeSettings);
	const panelRef = useRef<HTMLDivElement>(null);

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

	// Focus trap - focus panel on open
	useEffect(() => {
		if (isOpen && panelRef.current) {
			panelRef.current.focus();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
				onClick={closeSettings}
				aria-hidden="true"
			/>

			{/* Panel */}
			<div
				ref={panelRef}
				tabIndex={-1}
				className={cn(
					"relative z-10 flex flex-col",
					"w-full max-w-3xl max-h-[85vh]",
					"bg-background border border-border rounded-lg shadow-xl",
					"animate-in fade-in slide-in-from-bottom-4 duration-150",
					"outline-none"
				)}
			>
				{children}
			</div>
		</div>
	);
}
