# Settings Layout Makeover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert settings from two-panel sidebar layout to Linear-style single-surface modal with section index tabs.

**Architecture:** Single modal overlay renders on top of current route. Tabs smooth-scroll to sections, intersection observer syncs active tab. Search filters sections and highlights matches. Repositories render as single-expand accordion.

**Tech Stack:** React, Zustand, TanStack Router, Tailwind CSS, shadcn/ui

---

## Phase 1: Modal Infrastructure

### Task 1: Create Settings Modal Component

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsModal/SettingsModal.tsx`
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsModal/index.ts`

**Step 1: Create the modal component file**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsModal/SettingsModal.tsx
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
```

**Step 2: Create barrel export**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsModal/index.ts
export { SettingsModal } from "./SettingsModal";
```

**Step 3: Verify file created**

Run: `ls -la src/renderer/routes/_authenticated/settings/components/SettingsModal/`
Expected: Two files listed

**Step 4: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsModal/
git commit -m "feat(settings): add modal overlay component"
```

---

### Task 2: Create Modal Header Component

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsHeader/SettingsHeader.tsx`
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsHeader/index.ts`

**Step 1: Create the header component**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsHeader/SettingsHeader.tsx
import { X, Search } from "lucide-react";
import { Button } from "ui/components/ui/button";
import { Input } from "ui/components/ui/input";
import { cn } from "ui/lib/utils";
import {
	useSettingsStore,
	type SettingsSection,
} from "renderer/stores/settings-state";

const TABS: { id: SettingsSection; label: string }[] = [
	{ id: "appearance", label: "Appearance" },
	{ id: "preferences", label: "Preferences" },
	{ id: "presets", label: "Presets" },
	{ id: "sessions", label: "Sessions" },
	{ id: "repository", label: "Repositories" },
];

interface SettingsHeaderProps {
	activeTab: SettingsSection;
	onTabClick: (tab: SettingsSection) => void;
	disabledTabs?: SettingsSection[];
}

export function SettingsHeader({
	activeTab,
	onTabClick,
	disabledTabs = [],
}: SettingsHeaderProps) {
	const searchQuery = useSettingsStore((s) => s.searchQuery);
	const setSearchQuery = useSettingsStore((s) => s.setSearchQuery);
	const closeSettings = useSettingsStore((s) => s.closeSettings);

	return (
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
					const isActive = activeTab === tab.id;

					return (
						<button
							key={tab.id}
							type="button"
							disabled={isDisabled}
							onClick={() => onTabClick(tab.id)}
							className={cn(
								"px-3 py-1.5 text-sm rounded-md transition-colors",
								isActive
									? "bg-accent text-accent-foreground font-medium"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								isDisabled && "opacity-40 cursor-not-allowed"
							)}
						>
							{tab.label}
						</button>
					);
				})}
			</nav>

			{/* Close button */}
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0"
				onClick={closeSettings}
			>
				<X className="h-4 w-4" />
				<span className="sr-only">Close settings</span>
			</Button>
		</div>
	);
}
```

**Step 2: Create barrel export**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsHeader/index.ts
export { SettingsHeader } from "./SettingsHeader";
```

**Step 3: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsHeader/
git commit -m "feat(settings): add modal header with tabs and search"
```

---

### Task 3: Create Section Container Component

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsSection/SettingsSection.tsx`
- Create: `src/renderer/routes/_authenticated/settings/components/SettingsSection/index.ts`

**Step 1: Create the section component**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsSection/SettingsSection.tsx
import { forwardRef } from "react";
import { cn } from "ui/lib/utils";
import type { SettingsSection as SettingsSectionType } from "renderer/stores/settings-state";

interface SettingsSectionProps {
	id: SettingsSectionType;
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	isFirst?: boolean;
}

export const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(
	function SettingsSection(
		{ id, title, description, children, className, isFirst },
		ref
	) {
		return (
			<section
				ref={ref}
				id={`settings-section-${id}`}
				data-settings-section={id}
				className={cn(
					"scroll-mt-4",
					!isFirst && "border-t border-border pt-6 mt-6",
					className
				)}
			>
				<div className="mb-4">
					<h2 className="text-base font-medium">{title}</h2>
					{description && (
						<p className="text-sm text-muted-foreground mt-0.5">
							{description}
						</p>
					)}
				</div>
				<div>{children}</div>
			</section>
		);
	}
);
```

**Step 2: Create barrel export**

```tsx
// src/renderer/routes/_authenticated/settings/components/SettingsSection/index.ts
export { SettingsSection } from "./SettingsSection";
```

**Step 3: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsSection/
git commit -m "feat(settings): add section container with dividers"
```

---

### Task 4: Create Scroll Sync Hook

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/hooks/useScrollSync.ts`

**Step 1: Create the hook**

```tsx
// src/renderer/routes/_authenticated/settings/hooks/useScrollSync.ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { SettingsSection } from "renderer/stores/settings-state";

const SECTION_IDS: SettingsSection[] = [
	"appearance",
	"preferences",
	"presets",
	"sessions",
	"repository",
];

interface UseScrollSyncOptions {
	containerRef: React.RefObject<HTMLElement | null>;
}

export function useScrollSync({ containerRef }: UseScrollSyncOptions) {
	const [activeSection, setActiveSection] =
		useState<SettingsSection>("appearance");
	const sectionRefs = useRef<Map<SettingsSection, HTMLElement>>(new Map());
	const isScrollingRef = useRef(false);

	// Register section ref
	const registerSection = useCallback(
		(id: SettingsSection, element: HTMLElement | null) => {
			if (element) {
				sectionRefs.current.set(id, element);
			} else {
				sectionRefs.current.delete(id);
			}
		},
		[]
	);

	// Scroll to section
	const scrollToSection = useCallback(
		(id: SettingsSection) => {
			const element = sectionRefs.current.get(id);
			const container = containerRef.current;
			if (!element || !container) return;

			isScrollingRef.current = true;
			setActiveSection(id);

			element.scrollIntoView({ behavior: "smooth", block: "start" });

			// Reset scrolling flag after animation
			setTimeout(() => {
				isScrollingRef.current = false;
			}, 500);
		},
		[containerRef]
	);

	// Observe scroll position and update active section
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (isScrollingRef.current) return;

				// Find the topmost visible section
				const visibleSections: { id: SettingsSection; ratio: number }[] = [];

				for (const entry of entries) {
					if (entry.isIntersecting) {
						const id = entry.target.getAttribute(
							"data-settings-section"
						) as SettingsSection;
						if (id) {
							visibleSections.push({ id, ratio: entry.intersectionRatio });
						}
					}
				}

				if (visibleSections.length > 0) {
					// Sort by order in SECTION_IDS, pick first visible
					visibleSections.sort(
						(a, b) => SECTION_IDS.indexOf(a.id) - SECTION_IDS.indexOf(b.id)
					);
					setActiveSection(visibleSections[0].id);
				}
			},
			{
				root: container,
				threshold: [0, 0.25, 0.5, 0.75, 1],
				rootMargin: "-20% 0px -60% 0px",
			}
		);

		// Observe all sections
		for (const element of sectionRefs.current.values()) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	}, [containerRef]);

	return {
		activeSection,
		registerSection,
		scrollToSection,
	};
}
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/hooks/useScrollSync.ts
git commit -m "feat(settings): add scroll sync hook for tab navigation"
```

---

## Phase 2: Single-Surface Content Layout

### Task 5: Update Settings Layout to Render Modal

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/layout.tsx`

**Step 1: Read the current layout file**

Run: Read the file at `src/renderer/routes/_authenticated/settings/layout.tsx`

**Step 2: Replace layout with modal-based version**

```tsx
// src/renderer/routes/_authenticated/settings/layout.tsx
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
	const closeSettings = useSettingsStore((s) => s.closeSettings);

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
```

**Step 3: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/layout.tsx
git commit -m "feat(settings): convert layout to modal overlay"
```

---

### Task 6: Create Main Settings Page with All Sections

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/page.tsx`

**Step 1: Create the unified settings page**

```tsx
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
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/page.tsx
git commit -m "feat(settings): create unified settings page with all sections"
```

---

## Phase 3: Repositories Accordion

### Task 7: Create Repository Accordion Item Component

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/RepositoryAccordionItem.tsx`

**Step 1: Create the accordion item component**

```tsx
// src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/RepositoryAccordionItem.tsx
import type { Repository } from "lib/local-db";
import type { BranchPrefixMode } from "lib/local-db";
import { Button } from "ui/components/ui/button";
import { Input } from "ui/components/ui/input";
import { Label } from "ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { ChevronRight, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { cn } from "ui/lib/utils";
import { BRANCH_PREFIX_MODE_LABELS } from "../../utils/branch-prefix";

interface RepositoryAccordionItemProps {
	repository: Repository;
	isExpanded: boolean;
	onToggle: () => void;
}

export function RepositoryAccordionItem({
	repository,
	isExpanded,
	onToggle,
}: RepositoryAccordionItemProps) {
	const utils = electronTrpc.useUtils();

	// Local state for editing
	const [name, setName] = useState(repository.name);
	const [branchPrefixMode, setBranchPrefixMode] = useState<BranchPrefixMode>(
		repository.branchPrefixMode ?? "none"
	);
	const [branchPrefixCustom, setBranchPrefixCustom] = useState(
		repository.branchPrefixCustom ?? ""
	);
	const [setupScript, setSetupScript] = useState(repository.setupScript ?? "");
	const [teardownScript, setTeardownScript] = useState(
		repository.teardownScript ?? ""
	);

	// Sync with server data
	useEffect(() => {
		setName(repository.name);
		setBranchPrefixMode(repository.branchPrefixMode ?? "none");
		setBranchPrefixCustom(repository.branchPrefixCustom ?? "");
		setSetupScript(repository.setupScript ?? "");
		setTeardownScript(repository.teardownScript ?? "");
	}, [repository]);

	const updateRepository = electronTrpc.repositories.update.useMutation({
		onSettled: () => {
			utils.repositories.getAll.invalidate();
		},
	});

	const openInFinder = electronTrpc.repositories.openInFinder.useMutation();

	const handleNameBlur = () => {
		if (name !== repository.name) {
			updateRepository.mutate({ id: repository.id, name });
		}
	};

	const handleBranchPrefixModeChange = (mode: BranchPrefixMode) => {
		setBranchPrefixMode(mode);
		updateRepository.mutate({
			id: repository.id,
			branchPrefixMode: mode,
			branchPrefixCustom: mode === "custom" ? branchPrefixCustom : null,
		});
	};

	const handleBranchPrefixCustomBlur = () => {
		if (branchPrefixCustom !== repository.branchPrefixCustom) {
			updateRepository.mutate({
				id: repository.id,
				branchPrefixCustom: branchPrefixCustom || null,
			});
		}
	};

	const handleSetupScriptBlur = () => {
		if (setupScript !== repository.setupScript) {
			updateRepository.mutate({
				id: repository.id,
				setupScript: setupScript || null,
			});
		}
	};

	const handleTeardownScriptBlur = () => {
		if (teardownScript !== repository.teardownScript) {
			updateRepository.mutate({
				id: repository.id,
				teardownScript: teardownScript || null,
			});
		}
	};

	return (
		<div className="border-b border-border last:border-b-0">
			{/* Collapsed row */}
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"w-full flex items-center gap-3 px-4 py-3 text-left",
					"hover:bg-accent/30 transition-colors",
					isExpanded && "bg-accent/20"
				)}
			>
				<ChevronRight
					className={cn(
						"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
						isExpanded && "rotate-90"
					)}
				/>
				<span className="font-medium text-sm flex-1 truncate">
					{repository.name}
				</span>
				<span className="text-xs text-muted-foreground truncate max-w-[300px]">
					{repository.path}
				</span>
			</button>

			{/* Expanded content */}
			{isExpanded && (
				<div className="px-4 pb-4 pt-2 pl-11 space-y-4 bg-accent/10">
					{/* Repository Name */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">
							Repository Name
						</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							onBlur={handleNameBlur}
							className="max-w-sm"
						/>
					</div>

					{/* Repository Path */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">
							Repository Path
						</Label>
						<div className="flex items-center gap-2">
							<code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md">
								{repository.path}
							</code>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => openInFinder.mutate({ id: repository.id })}
							>
								<FolderOpen className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Branch Prefix */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">
							Branch Prefix
						</Label>
						<div className="flex items-center gap-2">
							<Select
								value={branchPrefixMode}
								onValueChange={(v) =>
									handleBranchPrefixModeChange(v as BranchPrefixMode)
								}
							>
								<SelectTrigger className="w-[180px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(
										Object.entries(BRANCH_PREFIX_MODE_LABELS) as [
											BranchPrefixMode,
											string
										][]
									).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{branchPrefixMode === "custom" && (
								<Input
									placeholder="prefix"
									value={branchPrefixCustom}
									onChange={(e) => setBranchPrefixCustom(e.target.value)}
									onBlur={handleBranchPrefixCustomBlur}
									className="w-[120px]"
								/>
							)}
						</div>
					</div>

					{/* Setup Script */}
					<div className="grid grid-cols-[140px_1fr] items-start gap-4">
						<Label className="text-sm text-muted-foreground pt-2">
							Setup Script
						</Label>
						<Input
							value={setupScript}
							onChange={(e) => setSetupScript(e.target.value)}
							onBlur={handleSetupScriptBlur}
							placeholder="e.g., npm install"
							className="max-w-md font-mono text-xs"
						/>
					</div>

					{/* Teardown Script */}
					<div className="grid grid-cols-[140px_1fr] items-start gap-4">
						<Label className="text-sm text-muted-foreground pt-2">
							Teardown Script
						</Label>
						<Input
							value={teardownScript}
							onChange={(e) => setTeardownScript(e.target.value)}
							onBlur={handleTeardownScriptBlur}
							placeholder="e.g., cleanup.sh"
							className="max-w-md font-mono text-xs"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/RepositoryAccordionItem.tsx
git commit -m "feat(settings): add repository accordion item component"
```

---

### Task 8: Create Repositories Accordion Container

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/RepositoriesAccordion.tsx`
- Create: `src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/index.ts`

**Step 1: Create the accordion container**

```tsx
// src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/RepositoriesAccordion.tsx
import { useMemo, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { RepositoryAccordionItem } from "./RepositoryAccordionItem";

interface RepositoriesAccordionProps {
	searchQuery?: string;
}

export function RepositoriesAccordion({
	searchQuery,
}: RepositoriesAccordionProps) {
	const { data: repositories, isLoading } =
		electronTrpc.repositories.getAll.useQuery();

	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Filter repositories by search query (match on name or path)
	const filteredRepositories = useMemo(() => {
		if (!repositories) return [];
		if (!searchQuery) return repositories;

		const q = searchQuery.toLowerCase();
		return repositories.filter(
			(repo) =>
				repo.name.toLowerCase().includes(q) ||
				repo.path.toLowerCase().includes(q)
		);
	}, [repositories, searchQuery]);

	const handleToggle = (id: string) => {
		setExpandedId((current) => (current === id ? null : id));
	};

	if (isLoading) {
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">
				Loading repositories...
			</div>
		);
	}

	if (!filteredRepositories.length) {
		if (searchQuery && repositories?.length) {
			return (
				<div className="py-8 text-center text-sm text-muted-foreground">
					No repositories matching "{searchQuery}"
				</div>
			);
		}
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">
				No repositories added yet. Open a repository to get started.
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border overflow-hidden">
			{filteredRepositories.map((repository) => (
				<RepositoryAccordionItem
					key={repository.id}
					repository={repository}
					isExpanded={expandedId === repository.id}
					onToggle={() => handleToggle(repository.id)}
				/>
			))}
		</div>
	);
}
```

**Step 2: Create barrel export**

```tsx
// src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/index.ts
export { RepositoriesAccordion } from "./RepositoriesAccordion";
export { RepositoryAccordionItem } from "./RepositoryAccordionItem";
```

**Step 3: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/RepositoriesAccordion/
git commit -m "feat(settings): add repositories accordion with single-expand"
```

---

## Phase 4: Search Integration

### Task 9: Update Settings Search to Include Repository Names

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/utils/settings-search/settings-search.ts`

**Step 1: Add function to search repositories**

Add this function after the existing `searchSettings` function:

```tsx
// Add to settings-search.ts after existing functions

export function searchSettingsWithRepositories(
	query: string,
	repositories: { id: string; name: string; path: string }[]
): {
	items: SettingsItem[];
	matchingRepositoryIds: string[];
} {
	const items = searchSettings(query);

	if (!query.trim()) {
		return { items, matchingRepositoryIds: [] };
	}

	const q = query.toLowerCase();
	const matchingRepositoryIds = repositories
		.filter(
			(repo) =>
				repo.name.toLowerCase().includes(q) ||
				repo.path.toLowerCase().includes(q)
		)
		.map((repo) => repo.id);

	return { items, matchingRepositoryIds };
}

export function repositorySectionHasMatches(
	query: string,
	repositories: { id: string; name: string; path: string }[]
): boolean {
	if (!query.trim()) return true;

	// Check if any repository settings items match
	const repoItems = searchSettings(query).filter(
		(item) => item.section === "repository"
	);
	if (repoItems.length > 0) return true;

	// Check if any repository names/paths match
	const q = query.toLowerCase();
	return repositories.some(
		(repo) =>
			repo.name.toLowerCase().includes(q) ||
			repo.path.toLowerCase().includes(q)
	);
}
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/utils/settings-search/settings-search.ts
git commit -m "feat(settings): add repository name search to settings search"
```

---

### Task 10: Add Search Highlight Component

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/components/SearchHighlight/SearchHighlight.tsx`
- Create: `src/renderer/routes/_authenticated/settings/components/SearchHighlight/index.ts`

**Step 1: Create the highlight component**

```tsx
// src/renderer/routes/_authenticated/settings/components/SearchHighlight/SearchHighlight.tsx
import { cn } from "ui/lib/utils";

interface SearchHighlightProps {
	text: string;
	query: string;
	className?: string;
}

export function SearchHighlight({
	text,
	query,
	className,
}: SearchHighlightProps) {
	if (!query.trim()) {
		return <span className={className}>{text}</span>;
	}

	const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));

	return (
		<span className={className}>
			{parts.map((part, i) =>
				part.toLowerCase() === query.toLowerCase() ? (
					<mark
						key={i}
						className={cn(
							"bg-yellow-500/30 text-foreground rounded-sm px-0.5",
							"dark:bg-yellow-400/20"
						)}
					>
						{part}
					</mark>
				) : (
					<span key={i}>{part}</span>
				)
			)}
		</span>
	);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

**Step 2: Create barrel export**

```tsx
// src/renderer/routes/_authenticated/settings/components/SearchHighlight/index.ts
export { SearchHighlight } from "./SearchHighlight";
```

**Step 3: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SearchHighlight/
git commit -m "feat(settings): add search highlight component"
```

---

## Phase 5: Adapt Existing Section Components

### Task 11: Simplify AppearanceSettings for Modal Use

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/appearance/components/AppearanceSettings/AppearanceSettings.tsx`

**Step 1: Read current file and simplify**

Remove the outer wrapper div with p-6 padding and heading, since the section container now provides those:

```tsx
// Replace the return statement in AppearanceSettings.tsx
// Before: <div className="p-6 max-w-4xl w-full">
// After: Remove outer wrapper since SettingsSection provides context

export function AppearanceSettings({ visibleItems }: AppearanceSettingsProps) {
	// ... existing state and logic ...

	return (
		<div className="space-y-6">
			{/* Theme Section */}
			{showTheme && (
				<div>
					<h3 className="text-sm font-medium mb-4">Interface Theme</h3>
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
						{allThemes.map((theme) => (
							<ThemeCard
								key={theme.id}
								theme={theme}
								isSelected={activeThemeId === theme.id}
								onSelect={() => setTheme(theme.id)}
							/>
						))}
					</div>
				</div>
			)}

			{showMarkdown && (
				<div className={showTheme ? "pt-6 border-t border-border" : ""}>
					<h3 className="text-sm font-medium mb-2">Markdown Rendering</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Configure how markdown content is displayed
					</p>
					<Select
						value={markdownStyle}
						onValueChange={(value) =>
							setMarkdownStyle(value as MarkdownStyle)
						}
					>
						<SelectTrigger className="w-[200px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="default">Default</SelectItem>
							<SelectItem value="tufte">Tufte</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground mt-2">
						Tufte style uses elegant serif typography inspired by Edward
						Tufte's books
					</p>
				</div>
			)}

			{showCustomThemes && (
				<div className={showTheme || showMarkdown ? "pt-6 border-t border-border" : ""}>
					<h3 className="text-sm font-medium mb-2">Custom Themes</h3>
					<p className="text-sm text-muted-foreground">
						Custom theme import coming soon. You'll be able to import JSON
						theme files to create your own themes.
					</p>
				</div>
			)}
		</div>
	);
}
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/appearance/components/AppearanceSettings/AppearanceSettings.tsx
git commit -m "refactor(settings): simplify AppearanceSettings for modal layout"
```

---

### Task 12: Simplify PreferencesSettings for Modal Use

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/preferences/components/PreferencesSettings/PreferencesSettings.tsx`

**Step 1: Remove outer wrapper and page header**

The component has `<div className="p-6 max-w-4xl w-full">` wrapper and a page header. Remove these since SettingsSection provides context:

```tsx
// In PreferencesSettings.tsx, replace the return statement
// Remove: <div className="p-6 max-w-4xl w-full">
// Remove: Page Header div
// Keep: <div className="space-y-10"> with sections inside

return (
	<div className="space-y-8">
		{/* Notification Sounds Section */}
		<section className="space-y-4">
			<h3 className="text-sm font-medium">Notification Sounds</h3>
			{/* ... rest unchanged ... */}
		</section>

		{/* Keyboard Shortcuts Section */}
		<section className="space-y-4">
			{/* ... unchanged ... */}
		</section>

		{/* Application Behavior Section */}
		<section className="space-y-4">
			{/* ... unchanged ... */}
		</section>

		{/* Link Handling Section */}
		<section className="space-y-4">
			{/* ... unchanged ... */}
		</section>

		{/* Dialogs remain unchanged */}
	</div>
);
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/preferences/components/PreferencesSettings/PreferencesSettings.tsx
git commit -m "refactor(settings): simplify PreferencesSettings for modal layout"
```

---

### Task 13: Simplify PresetsSettings for Modal Use

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/presets/components/PresetsSettings/PresetsSettings.tsx`

**Step 1: Remove outer wrapper and page header**

```tsx
// In PresetsSettings.tsx, replace the return statement
// Remove: <div className="p-6 max-w-7xl w-full">
// Remove: mb-8 header div

return (
	<div className="space-y-6">
		{/* Presets Section */}
		{(showPresets || showAgentTemplates) && (
			<div className="space-y-4">
				{/* ... content unchanged ... */}
			</div>
		)}

		{showAutoApplyPreset && (
			<div
				className={
					showPresets || showAgentTemplates
						? "flex items-center justify-between pt-6 border-t border-border"
						: "flex items-center justify-between"
				}
			>
				{/* ... content unchanged ... */}
			</div>
		)}
	</div>
);
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/presets/components/PresetsSettings/PresetsSettings.tsx
git commit -m "refactor(settings): simplify PresetsSettings for modal layout"
```

---

### Task 14: Simplify SessionsSettings for Modal Use

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/sessions/components/SessionsSettings/SessionsSettings.tsx`

**Step 1: Remove outer wrapper and page header**

```tsx
// In SessionsSettings.tsx, replace the return statement
// Remove: <div className="p-6 max-w-7xl w-full">
// Remove: mb-8 header div

return (
	<>
		<div className="space-y-6">
			{/* Active Sessions */}
			{showSessions && (
				<div className="space-y-4">
					{/* ... content unchanged ... */}
				</div>
			)}

			{/* Session Controls */}
			{showControls && (
				<div
					className={
						showSessions
							? "space-y-4 pt-6 border-t border-border"
							: "space-y-4"
					}
				>
					{/* ... content unchanged ... */}
				</div>
			)}
		</div>

		{/* AlertDialogs remain unchanged */}
	</>
);
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/sessions/components/SessionsSettings/SessionsSettings.tsx
git commit -m "refactor(settings): simplify SessionsSettings for modal layout"
```

---

## Phase 6: Cleanup and Route Updates

### Task 15: Remove Old Settings Sidebar

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/` (entire directory)

**Step 1: Delete the sidebar directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/components/SettingsSidebar
```

**Step 2: Commit**

```bash
git add -A src/renderer/routes/_authenticated/settings/components/SettingsSidebar/
git commit -m "cleanup(settings): remove old sidebar components"
```

---

### Task 16: Remove Individual Section Page Routes

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/appearance/page.tsx`
- Delete: `src/renderer/routes/_authenticated/settings/preferences/page.tsx`
- Delete: `src/renderer/routes/_authenticated/settings/presets/page.tsx`
- Delete: `src/renderer/routes/_authenticated/settings/sessions/page.tsx`
- Delete: `src/renderer/routes/_authenticated/settings/node/` (entire directory if exists)

**Step 1: Delete old page routes**

```bash
rm -f src/renderer/routes/_authenticated/settings/appearance/page.tsx
rm -f src/renderer/routes/_authenticated/settings/preferences/page.tsx
rm -f src/renderer/routes/_authenticated/settings/presets/page.tsx
rm -f src/renderer/routes/_authenticated/settings/sessions/page.tsx
rm -rf src/renderer/routes/_authenticated/settings/node/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "cleanup(settings): remove individual section page routes"
```

---

### Task 17: Simplify Settings State Store

**Files:**
- Modify: `src/renderer/stores/settings-state.ts`

**Step 1: Simplify the store**

Remove node-related state since node settings are accessed elsewhere:

```tsx
// src/renderer/stores/settings-state.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Settings sections available in the modal.
 */
export type SettingsSection =
	| "appearance"
	| "preferences"
	| "presets"
	| "sessions"
	| "repository";

interface SettingsState {
	activeSection: SettingsSection;
	searchQuery: string;
	isOpen: boolean;

	setActiveSection: (section: SettingsSection) => void;
	setSearchQuery: (query: string) => void;
	openSettings: (section?: SettingsSection) => void;
	closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
	devtools(
		(set) => ({
			activeSection: "appearance",
			searchQuery: "",
			isOpen: false,

			setActiveSection: (section) => set({ activeSection: section }),

			setSearchQuery: (query) => set({ searchQuery: query }),

			openSettings: (section) =>
				set({
					isOpen: true,
					activeSection: section ?? "appearance",
				}),

			closeSettings: () =>
				set({
					isOpen: false,
					searchQuery: "",
				}),
		}),
		{ name: "SettingsStore" }
	)
);

// Convenience hooks
export const useSettingsSection = () =>
	useSettingsStore((state) => state.activeSection);
export const useSetSettingsSection = () =>
	useSettingsStore((state) => state.setActiveSection);
export const useSettingsSearchQuery = () =>
	useSettingsStore((state) => state.searchQuery);
export const useSetSettingsSearchQuery = () =>
	useSettingsStore((state) => state.setSearchQuery);
export const useCloseSettings = () =>
	useSettingsStore((state) => state.closeSettings);
export const useOpenSettings = () =>
	useSettingsStore((state) => state.openSettings);
export const useSettingsIsOpen = () =>
	useSettingsStore((state) => state.isOpen);
```

**Step 2: Commit**

```bash
git add src/renderer/stores/settings-state.ts
git commit -m "refactor(settings): simplify settings store for modal"
```

---

### Task 18: Update Navigation to Open Settings Modal

**Files:**
- Search for: Any file that navigates to `/settings/*` routes

**Step 1: Find all navigation points**

```bash
grep -r "to=\"/settings" src/renderer --include="*.tsx" --include="*.ts"
grep -r "navigate.*settings" src/renderer --include="*.tsx" --include="*.ts"
```

**Step 2: Update to use store instead of navigation where appropriate**

For places that use `navigate({ to: "/settings/..." })`, consider whether they should:
- Keep navigation (deep-linking from URL)
- Use `openSettings(section)` directly

Most internal links should use the store:

```tsx
// Example: Replace
navigate({ to: "/settings/appearance" });

// With
import { useSettingsStore } from "renderer/stores/settings-state";
const openSettings = useSettingsStore((s) => s.openSettings);
openSettings("appearance");
```

**Step 3: Commit after each file update**

```bash
git add <modified-file>
git commit -m "refactor: update settings navigation to use modal store"
```

---

### Task 19: Generate Route Tree

**Step 1: Regenerate TanStack Router route tree**

```bash
cd /Volumes/Samsung\ T7/SuperCaspian/superset/apps/caspian && pnpm run generate:routes
```

**Step 2: Verify no TypeScript errors**

```bash
pnpm run typecheck
```

**Step 3: Commit**

```bash
git add src/renderer/routeTree.gen.ts
git commit -m "chore: regenerate route tree after settings refactor"
```

---

## Phase 7: Testing & Verification

### Task 20: Manual Testing Checklist

**Step 1: Test modal open/close**

- [ ] Press settings hotkey - modal opens
- [ ] Click backdrop - modal closes
- [ ] Press Escape - modal closes
- [ ] Click X button - modal closes

**Step 2: Test tab navigation**

- [ ] Click each tab - scrolls to section
- [ ] Scroll content - active tab updates

**Step 3: Test search**

- [ ] Type query - sections filter
- [ ] Matching items highlighted
- [ ] Non-matching tabs dimmed
- [ ] Clear search - all sections visible
- [ ] Search repository name - repository shows

**Step 4: Test repositories accordion**

- [ ] Click repo row - expands
- [ ] Click another - first collapses, second expands
- [ ] Edit name - saves on blur
- [ ] Change branch prefix - saves immediately
- [ ] Edit scripts - saves on blur

**Step 5: Test all settings functionality**

- [ ] Theme selection works
- [ ] Markdown style works
- [ ] Notifications toggle works
- [ ] Keyboard shortcuts work
- [ ] Confirm quit toggle works
- [ ] Presets CRUD works
- [ ] Sessions list works

**Step 6: Commit verification results**

```bash
git commit --allow-empty -m "test: verify settings modal functionality"
```

---

## Summary

**New Files Created:**
- `settings/components/SettingsModal/SettingsModal.tsx`
- `settings/components/SettingsModal/index.ts`
- `settings/components/SettingsHeader/SettingsHeader.tsx`
- `settings/components/SettingsHeader/index.ts`
- `settings/components/SettingsSection/SettingsSection.tsx`
- `settings/components/SettingsSection/index.ts`
- `settings/components/RepositoriesAccordion/RepositoriesAccordion.tsx`
- `settings/components/RepositoriesAccordion/RepositoryAccordionItem.tsx`
- `settings/components/RepositoriesAccordion/index.ts`
- `settings/components/SearchHighlight/SearchHighlight.tsx`
- `settings/components/SearchHighlight/index.ts`
- `settings/hooks/useScrollSync.ts`
- `settings/page.tsx`

**Files Modified:**
- `settings/layout.tsx`
- `settings/utils/settings-search/settings-search.ts`
- `settings/appearance/components/AppearanceSettings/AppearanceSettings.tsx`
- `settings/preferences/components/PreferencesSettings/PreferencesSettings.tsx`
- `settings/presets/components/PresetsSettings/PresetsSettings.tsx`
- `settings/sessions/components/SessionsSettings/SessionsSettings.tsx`
- `stores/settings-state.ts`

**Files Deleted:**
- `settings/components/SettingsSidebar/` (entire directory)
- `settings/appearance/page.tsx`
- `settings/preferences/page.tsx`
- `settings/presets/page.tsx`
- `settings/sessions/page.tsx`
- `settings/node/` (entire directory)

**Total Tasks:** 20
**Estimated Commits:** ~20
