import { createFileRoute } from "@tanstack/react-router";
import { PreferencesSettings } from "./components/PreferencesSettings/PreferencesSettings";

export const Route = createFileRoute("/_authenticated/settings/preferences/")({
	component: PreferencesPage,
});

function PreferencesPage() {
	return <PreferencesSettings />;
}
