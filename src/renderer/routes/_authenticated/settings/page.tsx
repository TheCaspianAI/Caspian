// src/renderer/routes/_authenticated/settings/page.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";
import { useSettingsStore } from "renderer/stores/settings-state";
import { SettingsHeader } from "./components/SettingsHeader";
import { SettingsSection } from "./components/SettingsSection";
import { useScrollSync } from "./hooks/useScrollSync";
import {
	getMatchingItemsForSection,
	searchSettings,
} from "./utils/settings-search";

// Import section content components
import { AppearanceSettings } from "./appearance/components/AppearanceSettings";
import { PreferencesSettings } from "./preferences/components/PreferencesSettings";
import { PresetsSettings } from "./presets/components/PresetsSettings";
import { SessionsSettings } from "./sessions/components/SessionsSettings";
import { RepositoriesAccordion } from "./components/RepositoriesAccordion";

export const Route = createFileRoute("/_authenticated/settings/")({
	component: SettingsPage,
});

function SettingsPage() {
	const searchQuery = useSettingsStore((s) => s.searchQuery);
	const containerRef = useRef<HTMLDivElement>(null);

	const { activeSection, registerSection, scrollToSection } = useScrollSync({
		containerRef,
	});

	// Compute which sections have matches
	const matchingItems = useMemo(
		() => (searchQuery ? searchSettings(searchQuery) : null),
		[searchQuery]
	);

	const sectionHasMatches = useCallback(
		(section: string) => {
			if (!matchingItems) return true;
			return matchingItems.some((item) => item.section === section);
		},
		[matchingItems]
	);

	// Get visible item IDs for each section
	const getVisibleItems = useCallback(
		(section: string) => {
			if (!searchQuery) return null;
			return getMatchingItemsForSection(searchQuery, section as any).map(
				(item) => item.id
			);
		},
		[searchQuery]
	);

	// Disabled tabs (sections with no search matches)
	const disabledTabs = useMemo(() => {
		if (!searchQuery) return [];
		const sections = [
			"appearance",
			"preferences",
			"presets",
			"sessions",
			"repository",
		] as const;
		return sections.filter((s) => !sectionHasMatches(s));
	}, [searchQuery, sectionHasMatches]);

	return (
		<>
			<SettingsHeader
				activeTab={activeSection}
				onTabClick={scrollToSection}
				disabledTabs={disabledTabs}
			/>

			<div
				ref={containerRef}
				className="flex-1 overflow-y-auto px-6 py-4"
			>
				{/* Appearance Section */}
				{sectionHasMatches("appearance") && (
					<SettingsSection
						ref={(el) => registerSection("appearance", el)}
						id="appearance"
						title="Appearance"
						description="Configure visual preferences for the interface"
						isFirst
					>
						<AppearanceSettings visibleItems={getVisibleItems("appearance")} />
					</SettingsSection>
				)}

				{/* Preferences Section */}
				{sectionHasMatches("preferences") && (
					<SettingsSection
						ref={(el) => registerSection("preferences", el)}
						id="preferences"
						title="Preferences"
						description="Configure application behavior and interaction settings"
					>
						<PreferencesSettings />
					</SettingsSection>
				)}

				{/* Presets Section */}
				{sectionHasMatches("presets") && (
					<SettingsSection
						ref={(el) => registerSection("presets", el)}
						id="presets"
						title="Presets"
						description="Manage execution configurations for AI coding agents"
					>
						<PresetsSettings visibleItems={getVisibleItems("presets")} />
					</SettingsSection>
				)}

				{/* Sessions Section */}
				{sectionHasMatches("sessions") && (
					<SettingsSection
						ref={(el) => registerSection("sessions", el)}
						id="sessions"
						title="Sessions"
						description="Monitor and control active agent sessions"
					>
						<SessionsSettings visibleItems={getVisibleItems("sessions")} />
					</SettingsSection>
				)}

				{/* Repositories Section */}
				{sectionHasMatches("repository") && (
					<SettingsSection
						ref={(el) => registerSection("repository", el)}
						id="repository"
						title="Repositories"
						description="Configure repository-specific settings"
					>
						<RepositoriesAccordion searchQuery={searchQuery} />
					</SettingsSection>
				)}
			</div>
		</>
	);
}
