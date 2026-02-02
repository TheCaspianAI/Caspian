import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import { toast } from "ui/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { HiChevronRight, HiMiniPlus } from "react-icons/hi2";
import {
	LuFolderOpen,
	LuPalette,
	LuPencil,
	LuSettings,
	LuX,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useUpdateRepository } from "renderer/react-query/repositories/useUpdateRepository";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useRepositoryRename } from "renderer/screens/main/hooks/useRepositoryRename";
import {
	REPOSITORY_COLOR_DEFAULT,
	REPOSITORY_COLORS,
} from "shared/constants/repository-colors";
import { STROKE_WIDTH } from "../constants";
import { RenameInput } from "../RenameInput";
import { CloseRepositoryDialog } from "./CloseRepositoryDialog";
import { RepositoryThumbnail } from "./RepositoryThumbnail";

interface RepositoryHeaderProps {
	repositoryId: string;
	repositoryName: string;
	repositoryColor: string;
	githubOwner: string | null;
	mainRepoPath: string;
	/** Whether the repository section is collapsed (nodes hidden) */
	isCollapsed: boolean;
	/** Whether the sidebar is in collapsed mode (icon-only view) */
	isSidebarCollapsed?: boolean;
	onToggleCollapse: () => void;
	nodeCount: number;
	onNewNode: () => void;
}

export function RepositoryHeader({
	repositoryId,
	repositoryName,
	repositoryColor,
	githubOwner,
	mainRepoPath,
	isCollapsed,
	isSidebarCollapsed = false,
	onToggleCollapse,
	nodeCount,
	onNewNode,
}: RepositoryHeaderProps) {
	const utils = electronTrpc.useUtils();
	const navigate = useNavigate();
	const params = useParams({ strict: false }) as { nodeId?: string };
	const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
	const rename = useRepositoryRename(repositoryId, repositoryName);

	const closeRepository = electronTrpc.repositories.close.useMutation({
		onMutate: async ({ id }) => {
			// Check if we're viewing a node from this repository BEFORE closing
			let shouldNavigate = false;

			if (params.nodeId) {
				try {
					const currentNode = await utils.nodes.get.fetch({
						id: params.nodeId,
					});
					shouldNavigate = currentNode?.repositoryId === id;
				} catch {
					// Node might not exist, skip navigation
				}
			}

			return { shouldNavigate };
		},
		onSuccess: async (data, { id }, context) => {
			utils.nodes.getAllGrouped.invalidate();
			utils.repositories.getRecents.invalidate();

			// Navigate away if we were viewing a node from the closed repository
			if (context?.shouldNavigate) {
				// Find a node from a different repository to navigate to
				const groups = await utils.nodes.getAllGrouped.fetch();
				const otherNode = groups
					.flatMap((group) => group.nodes)
					.find((n) => n.repositoryId !== id);

				if (otherNode) {
					navigateToNode(otherNode.id, navigate);
				} else {
					// No other nodes exist - go to node index
					navigate({ to: "/workspace" });
				}
			}

			if (data.terminalWarning) {
				toast.warning(data.terminalWarning);
			}
		},
		onError: (error) => {
			toast.error(`Failed to close repository: ${error.message}`);
		},
	});

	const openInFinder = electronTrpc.external.openInFinder.useMutation({
		onError: (error) => toast.error(`Failed to open: ${error.message}`),
	});

	const handleCloseRepository = () => {
		setIsCloseDialogOpen(true);
	};

	const handleConfirmClose = () => {
		closeRepository.mutate({ id: repositoryId });
	};

	const handleOpenInFinder = () => {
		openInFinder.mutate(mainRepoPath);
	};

	const handleOpenSettings = () => {
		navigate({ to: "/settings/repository/$repositoryId", params: { repositoryId } });
	};

	const updateRepository = useUpdateRepository({
		onError: (error) => toast.error(`Failed to update color: ${error.message}`),
	});

	const handleColorChange = (color: string) => {
		updateRepository.mutate({ id: repositoryId, patch: { color } });
	};

	// Color picker submenu used in both collapsed and expanded context menus
	const colorPickerSubmenu = (
		<ContextMenuSub>
			<ContextMenuSubTrigger>
				<LuPalette className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
				Set Color
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className="w-36">
				{REPOSITORY_COLORS.map((color) => {
					const isDefault = color.value === REPOSITORY_COLOR_DEFAULT;
					return (
						<ContextMenuItem
							key={color.value}
							onSelect={() => handleColorChange(color.value)}
							className="flex items-center gap-2"
						>
							<span
								className={cn(
									"size-3 rounded-full border",
									isDefault ? "border-border bg-muted" : "border-border/50",
								)}
								style={isDefault ? undefined : { backgroundColor: color.value }}
							/>
							<span>{color.name}</span>
							{repositoryColor === color.value && (
								<span className="ml-auto text-xs text-muted-foreground">✓</span>
							)}
						</ContextMenuItem>
					);
				})}
			</ContextMenuSubContent>
		</ContextMenuSub>
	);

	// Collapsed sidebar: show just the thumbnail with tooltip and context menu
	if (isSidebarCollapsed) {
		return (
			<>
				<ContextMenu>
					<Tooltip delayDuration={300}>
						<ContextMenuTrigger asChild>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={onToggleCollapse}
									className={cn(
										"flex items-center justify-center size-8 rounded-md",
										"hover:bg-muted/50 transition-colors",
									)}
								>
									<RepositoryThumbnail
										repositoryId={repositoryId}
										repositoryName={repositoryName}
										repositoryColor={repositoryColor}
										githubOwner={githubOwner}
									/>
								</button>
							</TooltipTrigger>
						</ContextMenuTrigger>
						<TooltipContent side="right" className="flex flex-col gap-0.5">
							<span className="font-medium">{repositoryName}</span>
							<span className="text-xs text-muted-foreground">
								{nodeCount} node{nodeCount !== 1 ? "s" : ""}
							</span>
						</TooltipContent>
					</Tooltip>
					<ContextMenuContent>
						<ContextMenuItem onSelect={rename.startRename}>
							<LuPencil className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
							Rename
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem onSelect={handleOpenInFinder}>
							<LuFolderOpen
								className="size-4 mr-2"
								strokeWidth={STROKE_WIDTH}
							/>
							Open in Finder
						</ContextMenuItem>
						<ContextMenuItem onSelect={handleOpenSettings}>
							<LuSettings className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
							Repository Settings
						</ContextMenuItem>
						{colorPickerSubmenu}
						<ContextMenuSeparator />
						<ContextMenuItem
							onSelect={handleCloseRepository}
							disabled={closeRepository.isPending}
							className="text-destructive focus:text-destructive"
						>
							<LuX
								className="size-4 mr-2 text-destructive"
								strokeWidth={STROKE_WIDTH}
							/>
							{closeRepository.isPending ? "Closing..." : "Close Repository"}
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>

				<CloseRepositoryDialog
					repositoryName={repositoryName}
					nodeCount={nodeCount}
					open={isCloseDialogOpen}
					onOpenChange={setIsCloseDialogOpen}
					onConfirm={handleConfirmClose}
				/>
			</>
		);
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						className={cn(
							"flex items-center w-full pl-3 pr-2 py-1.5 text-sm font-medium",
							"hover:bg-muted/50 transition-colors",
						)}
					>
						{/* Main clickable area */}
						{rename.isRenaming ? (
							<div className="flex items-center gap-2 flex-1 min-w-0 py-0.5">
								<RepositoryThumbnail
									repositoryId={repositoryId}
									repositoryName={repositoryName}
									repositoryColor={repositoryColor}
									githubOwner={githubOwner}
								/>
								<RenameInput
									value={rename.renameValue}
									onChange={rename.setRenameValue}
									onSubmit={rename.submitRename}
									onCancel={rename.cancelRename}
									className="h-6 px-1 py-0 text-sm -ml-1 font-medium bg-transparent border-none outline-none flex-1 min-w-0"
								/>
							</div>
						) : (
							<button
								type="button"
								onClick={onToggleCollapse}
								onDoubleClick={rename.startRename}
								className="flex items-center gap-2 flex-1 min-w-0 py-0.5 text-left cursor-pointer"
							>
								<RepositoryThumbnail
									repositoryId={repositoryId}
									repositoryName={repositoryName}
									repositoryColor={repositoryColor}
									githubOwner={githubOwner}
								/>
								<span className="truncate">{repositoryName}</span>
								<span className="text-xs text-muted-foreground tabular-nums font-normal">
									({nodeCount})
								</span>
							</button>
						)}

						{/* Add node button */}
						<Tooltip delayDuration={500}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onNewNode();
									}}
									onContextMenu={(e) => e.stopPropagation()}
									className="p-1 rounded hover:bg-muted transition-colors shrink-0 ml-1"
								>
									<HiMiniPlus className="size-4 text-muted-foreground" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>
								New node
							</TooltipContent>
						</Tooltip>

						{/* Collapse chevron */}
						<button
							type="button"
							onClick={onToggleCollapse}
							onContextMenu={(e) => e.stopPropagation()}
							aria-expanded={!isCollapsed}
							className="p-1 rounded hover:bg-muted transition-colors shrink-0 ml-1"
						>
							<HiChevronRight
								className={cn(
									"size-3.5 text-muted-foreground transition-transform duration-150",
									!isCollapsed && "rotate-90",
								)}
							/>
						</button>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onSelect={rename.startRename}>
						<LuPencil className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
						Rename
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem onSelect={handleOpenInFinder}>
						<LuFolderOpen className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
						Open in Finder
					</ContextMenuItem>
					<ContextMenuItem onSelect={handleOpenSettings}>
						<LuSettings className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
						Repository Settings
					</ContextMenuItem>
					{colorPickerSubmenu}
					<ContextMenuSeparator />
					<ContextMenuItem
						onSelect={handleCloseRepository}
						disabled={closeRepository.isPending}
						className="text-destructive focus:text-destructive"
					>
						<LuX
							className="size-4 mr-2 text-destructive"
							strokeWidth={STROKE_WIDTH}
						/>
						{closeRepository.isPending ? "Closing..." : "Close Repository"}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<CloseRepositoryDialog
				repositoryName={repositoryName}
				nodeCount={nodeCount}
				open={isCloseDialogOpen}
				onOpenChange={setIsCloseDialogOpen}
				onConfirm={handleConfirmClose}
			/>
		</>
	);
}
