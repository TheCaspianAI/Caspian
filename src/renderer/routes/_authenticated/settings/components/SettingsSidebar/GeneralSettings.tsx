import { cn } from "ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
	HiOutlineAdjustmentsHorizontal,
	HiOutlineCommandLine,
	HiOutlinePaintBrush,
	HiOutlineSignal,
} from "react-icons/hi2";
import type { SettingsSection } from "renderer/stores/settings-state";

interface GeneralSettingsProps {
	matchCounts: Partial<Record<SettingsSection, number>> | null;
}

type SettingsRoute =
	| "/settings/appearance"
	| "/settings/preferences"
	| "/settings/presets"
	| "/settings/sessions";

const GENERAL_SECTIONS: {
	id: SettingsRoute;
	section: SettingsSection;
	label: string;
	icon: React.ReactNode;
}[] = [
	{
		id: "/settings/appearance",
		section: "appearance",
		label: "Appearance",
		icon: <HiOutlinePaintBrush className="h-4 w-4" />,
	},
	{
		id: "/settings/preferences",
		section: "preferences",
		label: "Preferences",
		icon: <HiOutlineAdjustmentsHorizontal className="h-4 w-4" />,
	},
	{
		id: "/settings/presets",
		section: "presets",
		label: "Presets",
		icon: <HiOutlineCommandLine className="h-4 w-4" />,
	},
	{
		id: "/settings/sessions",
		section: "sessions",
		label: "Sessions",
		icon: <HiOutlineSignal className="h-4 w-4" />,
	},
];

export function GeneralSettings({ matchCounts }: GeneralSettingsProps) {
	const matchRoute = useMatchRoute();

	// When searching, only show sections that have matches
	const filteredSections = matchCounts
		? GENERAL_SECTIONS.filter(
				(section) => (matchCounts[section.section] ?? 0) > 0,
			)
		: GENERAL_SECTIONS;

	if (filteredSections.length === 0) {
		return null;
	}

	return (
		<div className="mb-4">
			<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
				General
			</h2>
			<nav className="flex flex-col gap-0.5">
				{filteredSections.map((section) => {
					const isActive = matchRoute({ to: section.id });
					const count = matchCounts?.[section.section];

					return (
						<Link
							key={section.id}
							to={section.id}
							className={cn(
								"flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors text-left",
								isActive
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
							)}
						>
							{section.icon}
							<span className="flex-1">{section.label}</span>
							{count !== undefined && count > 0 && (
								<span className="text-xs text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
									{count}
								</span>
							)}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
