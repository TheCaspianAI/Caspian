import type { ReactNode } from "react";
import { useEffectiveHotkeysMap, useHotkeysStore } from "renderer/stores/hotkeys";
import { formatHotkeyDisplay, type HotkeyId } from "shared/hotkeys";
import { Kbd } from "ui/components/ui/kbd";

export interface HotkeyTooltipContentItem {
	label: string;
	id: HotkeyId;
}

interface HotkeyTooltipContentProps {
	label: string;
	hotkeyId?: HotkeyId;
	items?: HotkeyTooltipContentItem[];
	showUnassigned?: boolean;
	unassignedPlaceholder?: ReactNode;
}

function isUnassigned(display: string[]): boolean {
	return display.length === 1 && display[0] === "Unassigned";
}

export function HotkeyTooltipContent({
	label,
	hotkeyId,
	items,
	showUnassigned = false,
	unassignedPlaceholder = null,
}: HotkeyTooltipContentProps) {
	const platform = useHotkeysStore((state) => state.platform);
	const effective = useEffectiveHotkeysMap();

	const getDisplay = (id: HotkeyId): string[] => {
		const keys = effective[id] ?? null;
		return formatHotkeyDisplay(keys, platform);
	};

	const renderShortcut = (id?: HotkeyId): ReactNode => {
		if (!id) return null;
		const display = getDisplay(id);
		if (isUnassigned(display)) {
			return showUnassigned ? unassignedPlaceholder : null;
		}

		// Render all keys as a single element (e.g., "⌘P" instead of "⌘" "P")
		return <Kbd>{display.join("")}</Kbd>;
	};

	if (items?.length) {
		const visibleItems = showUnassigned
			? items
			: items.filter((item) => !isUnassigned(getDisplay(item.id)));

		return (
			<div className="flex flex-col gap-1">
				<span>{label}</span>
				{visibleItems.length > 0 && (
					<div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
						{visibleItems.map((item) => (
							<span key={item.id} className="flex items-center justify-between gap-2">
								<span>{item.label}</span>
								{renderShortcut(item.id)}
							</span>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<span className="flex items-center gap-2">
			{label}
			{renderShortcut(hotkeyId)}
		</span>
	);
}
