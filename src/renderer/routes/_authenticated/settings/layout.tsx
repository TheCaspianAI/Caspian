import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettingsStore } from "renderer/stores/settings-state";
import { SettingsModal } from "./components/SettingsModal";

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const navigate = useNavigate();
	const isOpen = useSettingsStore((s) => s.isOpen);
	const openSettings = useSettingsStore((s) => s.openSettings);

	// Open modal when navigating to /settings
	useEffect(() => {
		if (!isOpen) {
			openSettings();
		}
	}, [isOpen, openSettings]);

	// Navigate away when modal closes
	useEffect(() => {
		const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
			if (prevState.isOpen && !state.isOpen) {
				navigate({ to: "/" });
			}
		});
		return unsubscribe;
	}, [navigate]);

	return (
		<SettingsModal>
			<Outlet />
		</SettingsModal>
	);
}
