import { CiSettings } from "react-icons/ci";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { useOpenSettings } from "renderer/stores/settings-state";
import { Button } from "ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";

export function SettingsButton() {
	const openSettings = useOpenSettings();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => openSettings()}
					aria-label="Open settings"
					className="no-drag"
				>
					<CiSettings className="size-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={8}>
				<HotkeyTooltipContent label="Open settings" hotkeyId="OPEN_SETTINGS" />
			</TooltipContent>
		</Tooltip>
	);
}
