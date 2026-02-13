import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
// Import section content components
import { AppearanceSettings } from "renderer/routes/_authenticated/settings/appearance/components/AppearanceSettings";
import { RepositoriesAccordion } from "renderer/routes/_authenticated/settings/components/RepositoriesAccordion";
import { PreferencesSettings } from "renderer/routes/_authenticated/settings/preferences/components/PreferencesSettings";
import { PresetsSettings } from "renderer/routes/_authenticated/settings/presets/components/PresetsSettings";
import { SessionsSettings } from "renderer/routes/_authenticated/settings/sessions/components/SessionsSettings";
import {
	getMatchingItemsForSection,
	searchSettings,
} from "renderer/routes/_authenticated/settings/utils/settings-search";
import { type SettingsSection, useSettingsStore } from "renderer/stores/settings-state";
import { Button } from "ui/components/ui/button";
import { Input } from "ui/components/ui/input";
import { cn } from "ui/lib/utils";
import { useScrollSync } from "./useScrollSync";

const TABS: { id: SettingsSection; label: string }[] = [
	{ id: "appearance", label: "Appearance" },
	{ id: "preferences", label: "Preferences" },
	{ id: "presets", label: "Presets" },
	{ id: "sessions", label: "Sessions" },
	{ id: "repository", label: "Repositories" },
];

interface SettingsContentProps {
	onClose: () => void;
}

export function SettingsContent({ onClose }: SettingsContentProps) {
	const searchQuery = useSettingsStore((s) => s.searchQuery);
	const setSearchQuery = useSettingsStore((s) => s.setSearchQuery);
	const storeActiveSection = useSettingsStore((s) => s.activeSection);
	const containerRef = useRef<HTMLDivElement>(null);

	const { activeSection, registerSection, scrollToSection } = useScrollSync({
		containerRef,
	});

	// Scroll to the requested section from store on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally run only on mount
	useEffect(() => {
		if (storeActiveSection !== "appearance") {
			// Delay to ensure sections are registered after render
			const timer = setTimeout(() => {
				scrollToSection(storeActiveSection);
			}, 0);
			return () => clearTimeout(timer);
		}
	}, []);

	// Compute which sections have matches
	const matchingItems = useMemo(
		() => (searchQuery ? searchSettings(searchQuery) : null),
		[searchQuery],
	);

	const sectionHasMatches = useCallback(
		(section: string) => {
			if (!matchingItems) return true;
			return matchingItems.some((item) => item.section === section);
		},
		[matchingItems],
	);

	// Get visible item IDs for each section
	const getVisibleItems = useCallback(
		(section: SettingsSection) => {
			if (!searchQuery) return null;
			return getMatchingItemsForSection(searchQuery, section).map((item) => item.id);
		},
		[searchQuery],
	);

	// Disabled tabs (sections with no search matches)
	const disabledTabs = useMemo(() => {
		if (!searchQuery) return [];
		const sections = ["appearance", "preferences", "presets", "sessions", "repository"] as const;
		return sections.filter((s) => !sectionHasMatches(s));
	}, [searchQuery, sectionHasMatches]);

	return (
		<>
			{/* Header */}
			<div className="flex items-center gap-4 px-4 py-3 border-b border-border shrink-0">
				{/* Search input */}
				<div className="relative w-48">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
					<Input
						type="text"
						placeholder="Search settings..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-8 text-sm"
					/>
				</div>

				{/* Tabs */}
				<nav className="flex items-center gap-1 flex-1 justify-center">
					{TABS.map((tab) => {
						const isDisabled = disabledTabs.includes(tab.id);
						const isActive = activeSection === tab.id;

						return (
							<button
								key={tab.id}
								type="button"
								disabled={isDisabled}
								onClick={() => scrollToSection(tab.id)}
								className={cn(
									"px-3 py-1.5 text-sm rounded-md transition-colors",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
									isDisabled && "opacity-40 cursor-not-allowed",
								)}
							>
								{tab.label}
							</button>
						);
					})}
				</nav>

				{/* Close button */}
				<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
					<X className="h-4 w-4" />
					<span className="sr-only">Close settings</span>
				</Button>
			</div>

			{/* Content */}
			<div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4">
				{/* Appearance Section */}
				{sectionHasMatches("appearance") && (
					<Section
						ref={(el) => registerSection("appearance", el)}
						id="appearance"
						title="Appearance"
						description="Configure visual preferences for the interface"
						isFirst
					>
						<AppearanceSettings visibleItems={getVisibleItems("appearance")} />
					</Section>
				)}

				{/* Preferences Section */}
				{sectionHasMatches("preferences") && (
					<Section
						ref={(el) => registerSection("preferences", el)}
						id="preferences"
						title="Preferences"
						description="Configure application behavior and interaction settings"
					>
						<PreferencesSettings />
					</Section>
				)}

				{/* Presets Section */}
				{sectionHasMatches("presets") && (
					<Section
						ref={(el) => registerSection("presets", el)}
						id="presets"
						title="Presets"
						description="Manage execution configurations for AI coding agents"
					>
						<PresetsSettings visibleItems={getVisibleItems("presets")} />
					</Section>
				)}

				{/* Sessions Section */}
				{sectionHasMatches("sessions") && (
					<Section
						ref={(el) => registerSection("sessions", el)}
						id="sessions"
						title="Sessions"
						description="Monitor and control active agent sessions"
					>
						<SessionsSettings visibleItems={getVisibleItems("sessions")} />
					</Section>
				)}

				{/* Repositories Section */}
				{sectionHasMatches("repository") && (
					<Section
						ref={(el) => registerSection("repository", el)}
						id="repository"
						title="Repositories"
						description="Configure repository-specific settings"
					>
						<RepositoriesAccordion searchQuery={searchQuery} />
					</Section>
				)}
			</div>
		</>
	);
}

// Inline Section component
import { forwardRef } from "react";

interface SectionProps {
	id: SettingsSection;
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	isFirst?: boolean;
}

const Section = forwardRef<HTMLElement, SectionProps>(function Section(
	{ id, title, description, children, className, isFirst },
	ref,
) {
	return (
		<section
			ref={ref}
			id={`settings-section-${id}`}
			data-settings-section={id}
			className={cn("scroll-mt-4", !isFirst && "border-t border-border pt-6 mt-6", className)}
		>
			<div className="mb-4">
				<h2 className="text-base font-medium">{title}</h2>
				{description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
			</div>
			<div>{children}</div>
		</section>
	);
});
