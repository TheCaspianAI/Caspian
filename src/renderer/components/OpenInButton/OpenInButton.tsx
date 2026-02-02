import type { ExternalApp } from "lib/local-db";
import { Button } from "ui/components/ui/button";
import { ButtonGroup } from "ui/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "ui/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { LuCopy } from "react-icons/lu";
import cursorIcon from "renderer/assets/app-icons/cursor.svg";
import finderIcon from "renderer/assets/app-icons/finder.png";
import terminalIcon from "renderer/assets/app-icons/terminal.png";
import vscodeIcon from "renderer/assets/app-icons/vscode.svg";
import warpIcon from "renderer/assets/app-icons/warp.png";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useHotkeyText } from "renderer/stores/hotkeys";

interface AppOption {
	id: ExternalApp;
	label: string;
	icon: string;
	displayLabel?: string;
}

export const APP_OPTIONS: AppOption[] = [
	{ id: "finder", label: "Finder", icon: finderIcon },
	{ id: "cursor", label: "Cursor", icon: cursorIcon },
	{ id: "warp", label: "Warp", icon: warpIcon },
	{ id: "terminal", label: "Terminal", icon: terminalIcon },
	{ id: "vscode", label: "VS Code", icon: vscodeIcon, displayLabel: "VS Code" },
];

const ALL_APP_OPTIONS = APP_OPTIONS;

export const getAppOption = (id: ExternalApp) =>
	ALL_APP_OPTIONS.find((app) => app.id === id) ?? APP_OPTIONS[1];

export interface OpenInButtonProps {
	path: string | undefined;
	/** Optional label to show next to the icon (e.g., folder name) */
	label?: string;
	/** Show keyboard shortcut hints */
	showShortcuts?: boolean;
}

export function OpenInButton({
	path,
	label,
	showShortcuts = false,
}: OpenInButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const utils = electronTrpc.useUtils();
	const openInShortcut = useHotkeyText("OPEN_IN_APP");
	const copyPathShortcut = useHotkeyText("COPY_PATH");
	const showOpenInShortcut = showShortcuts && openInShortcut !== "Unassigned";
	const showCopyPathShortcut =
		showShortcuts && copyPathShortcut !== "Unassigned";

	const { data: lastUsedApp = "cursor" } =
		electronTrpc.settings.getLastUsedApp.useQuery();

	const openInApp = electronTrpc.external.openInApp.useMutation({
		onSuccess: () => utils.settings.getLastUsedApp.invalidate(),
	});
	const copyPath = electronTrpc.external.copyPath.useMutation();

	const currentApp = getAppOption(lastUsedApp);

	const handleOpenIn = (app: ExternalApp) => {
		if (!path) return;
		openInApp.mutate({ path, app });
		setIsOpen(false);
	};

	const handleCopyPath = () => {
		if (!path) return;
		copyPath.mutate(path);
		setIsOpen(false);
	};

	const handleOpenLastUsed = () => {
		if (!path) return;
		openInApp.mutate({ path, app: lastUsedApp });
	};

	return (
		<ButtonGroup>
			{label && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={handleOpenLastUsed}
							disabled={!path}
						>
							<img
								src={currentApp.icon}
								alt=""
								className="size-4 object-contain"
							/>
							<span className="font-medium">{label}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" showArrow={false}>
						{`Open in ${currentApp.displayLabel ?? currentApp.label}${
							showOpenInShortcut ? ` (${openInShortcut})` : ""
						}`}
					</TooltipContent>
				</Tooltip>
			)}
			<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="gap-1"
						disabled={!path}
					>
						<span>Open</span>
						<HiChevronDown className="size-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					{APP_OPTIONS.map((app) => (
						<DropdownMenuItem
							key={app.id}
							onClick={() => handleOpenIn(app.id)}
							className="flex items-center justify-between"
						>
							<div className="flex items-center gap-2">
								<img
									src={app.icon}
									alt={app.label}
									className="size-4 object-contain"
								/>
								<span>{app.label}</span>
							</div>
							{showOpenInShortcut && app.id === lastUsedApp && (
								<span className="text-xs text-muted-foreground">
									{openInShortcut}
								</span>
							)}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={handleCopyPath}
						className="flex items-center justify-between"
					>
						<div className="flex items-center gap-2">
							<LuCopy className="size-4" />
							<span>Copy path</span>
						</div>
						{showCopyPathShortcut && (
							<span className="text-xs text-muted-foreground">
								{copyPathShortcut}
							</span>
						)}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
