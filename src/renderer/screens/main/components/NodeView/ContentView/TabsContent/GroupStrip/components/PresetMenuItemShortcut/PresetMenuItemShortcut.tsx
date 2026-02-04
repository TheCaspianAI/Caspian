import { PRESET_HOTKEY_IDS } from "renderer/routes/_authenticated/_dashboard/node/$nodeId/hooks/usePresetHotkeys";
import { useHotkeyText } from "renderer/stores/hotkeys";
import type { HotkeyId } from "shared/hotkeys";
import { DropdownMenuShortcut } from "ui/components/ui/dropdown-menu";

function PresetMenuItemShortcutInner({ hotkeyId }: { hotkeyId: HotkeyId }) {
	const hotkeyText = useHotkeyText(hotkeyId);

	if (hotkeyText === "Unassigned") {
		return null;
	}

	return <DropdownMenuShortcut>{hotkeyText}</DropdownMenuShortcut>;
}

export function PresetMenuItemShortcut({ index }: { index: number }) {
	const hotkeyId = PRESET_HOTKEY_IDS[index];

	if (!hotkeyId) {
		return null;
	}

	return <PresetMenuItemShortcutInner hotkeyId={hotkeyId} />;
}
