import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/terminal/")({
	component: TerminalRedirect,
});

// Terminal has been split into Presets and Sessions
function TerminalRedirect() {
	return <Navigate to="/settings/presets" replace />;
}
