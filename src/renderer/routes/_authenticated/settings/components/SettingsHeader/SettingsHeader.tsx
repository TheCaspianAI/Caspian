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
