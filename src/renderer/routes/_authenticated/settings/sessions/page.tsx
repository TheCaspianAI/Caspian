import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSettingsSearchQuery } from "renderer/stores/settings-state";
import { getMatchingItemsForSection } from "../utils/settings-search";
import { SessionsSettings } from "./components/SessionsSettings";

export const Route = createFileRoute("/_authenticated/settings/sessions/")({
	component: SessionsSettingsPage,
});

function SessionsSettingsPage() {
	const searchQuery = useSettingsSearchQuery();

	const visibleItems = useMemo(() => {
		if (!searchQuery) return null;
		return getMatchingItemsForSection(searchQuery, "sessions").map(
			(item) => item.id,
		);
	}, [searchQuery]);

	return <SessionsSettings visibleItems={visibleItems} />;
}
