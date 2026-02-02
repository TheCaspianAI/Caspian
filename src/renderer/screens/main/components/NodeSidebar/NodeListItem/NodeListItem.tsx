import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "ui/components/ui/hover-card";
import { Input } from "ui/components/ui/input";
import { toast } from "ui/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { HiMiniXMark } from "react-icons/hi2";
import {
	LuCopy,
	LuEye,
	LuEyeOff,
	LuFolder,
	LuFolderGit2,
	LuFolderOpen,
	LuPencil,
	LuX,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	useReorderNodes,
	useNodeDeleteHandler,
} from "renderer/react-query/nodes";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { AsciiSpinner } from "renderer/screens/main/components/AsciiSpinner";
import { StatusIndicator } from "renderer/screens/main/components/StatusIndicator";
import { useNodeRename } from "renderer/screens/main/hooks/useNodeRename";
import { useTabsStore } from "renderer/stores/tabs/store";
import { extractPaneIdsFromLayout } from "renderer/stores/tabs/utils";
import { getHighestPriorityStatus } from "shared/tabs-types";
import { STROKE_WIDTH } from "../constants";
import {
	BranchSwitcher,
	DeleteNodeDialog,
	NodeHoverCardContent,
} from "./components";
import {
	GITHUB_STATUS_STALE_TIME,
	HOVER_CARD_CLOSE_DELAY,
	HOVER_CARD_OPEN_DELAY,
	MAX_KEYBOARD_SHORTCUT_INDEX,
} from "./constants";
import { NodeDiffStats } from "./NodeDiffStats";
import { NodeStatusBadge } from "./NodeStatusBadge";

const NODE_TYPE = "NODE";

interface NodeListItemProps {
	id: string;
	repositoryId: string;
	worktreePath: string;
	name: string;
	branch: string;
	type: "worktree" | "branch";
	isUnread?: boolean;
	index: number;
	shortcutIndex?: number;
	/** Whether the sidebar is in collapsed mode (icon-only view) */
	isCollapsed?: boolean;
}

export function NodeListItem({
	id,
	repositoryId,
	worktreePath,
	name,
	branch,
	type,
	isUnread = false,
	index,
	shortcutIndex,
	isCollapsed = false,
}: NodeListItemProps) {
	const isBranchNode = type === "branch";
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const reorderNodes = useReorderNodes();
	const [hasHovered, setHasHovered] = useState(false);
	const rename = useNodeRename(id, name);
	const tabs = useTabsStore((s) => s.tabs);
	const panes = useTabsStore((s) => s.panes);
	const clearNodeAttentionStatus = useTabsStore(
		(s) => s.clearNodeAttentionStatus,
	);
	const utils = electronTrpc.useUtils();

	// Derive isActive from route
	const isActive = !!matchRoute({
		to: "/workspace/$workspaceId",
		params: { workspaceId: id },
	});
	const openInFinder = electronTrpc.external.openInFinder.useMutation({
		onError: (error) => toast.error(`Failed to open: ${error.message}`),
	});
	const setUnread = electronTrpc.nodes.setUnread.useMutation({
		onSuccess: () => {
			utils.nodes.getAllGrouped.invalidate();
		},
		onError: (error) =>
			toast.error(`Failed to update unread status: ${error.message}`),
	});

	// Shared delete logic
	const { showDeleteDialog, setShowDeleteDialog, handleDeleteClick } =
		useNodeDeleteHandler();

	// Lazy-load GitHub status on hover to avoid N+1 queries
	const { data: githubStatus } =
		electronTrpc.nodes.getGitHubStatus.useQuery(
			{ nodeId: id },
			{
				enabled: hasHovered && type === "worktree",
				staleTime: GITHUB_STATUS_STALE_TIME,
			},
		);

	// Lazy-load local git changes on hover
	const { data: localChanges } = electronTrpc.changes.getStatus.useQuery(
		{ worktreePath },
		{
			enabled: hasHovered && type === "worktree" && !!worktreePath,
			staleTime: GITHUB_STATUS_STALE_TIME,
		},
	);

	// Calculate total local changes (staged + unstaged + untracked)
	const localDiffStats = useMemo(() => {
		if (!localChanges) return null;
		const allFiles = [
			...localChanges.staged,
			...localChanges.unstaged,
			...localChanges.untracked,
		];
		const additions = allFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
		const deletions = allFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);
		if (additions === 0 && deletions === 0) return null;
		return { additions, deletions };
	}, [localChanges]);

	// Memoize node pane IDs to avoid recalculating on every render
	const nodePaneIds = useMemo(() => {
		const nodeTabs = tabs.filter((t) => t.nodeId === id);
		return new Set(
			nodeTabs.flatMap((t) => extractPaneIdsFromLayout(t.layout)),
		);
	}, [tabs, id]);

	// Compute aggregate status for node using shared priority logic
	const nodeStatus = useMemo(() => {
		// Generator avoids array allocation
		function* paneStatuses() {
			for (const paneId of nodePaneIds) {
				yield panes[paneId]?.status;
			}
		}
		return getHighestPriorityStatus(paneStatuses());
	}, [panes, nodePaneIds]);

	const handleClick = () => {
		if (!rename.isRenaming) {
			clearNodeAttentionStatus(id);
			navigateToNode(id, navigate);
		}
	};

	const handleMouseEnter = () => {
		if (!hasHovered) {
			setHasHovered(true);
		}
	};

	const handleOpenInFinder = () => {
		if (worktreePath) {
			openInFinder.mutate(worktreePath);
		}
	};

	const handleToggleUnread = () => {
		setUnread.mutate({ id, isUnread: !isUnread });
	};

	const handleCopyPath = async () => {
		if (worktreePath) {
			try {
				await navigator.clipboard.writeText(worktreePath);
				toast.success("Path copied to clipboard");
			} catch {
				toast.error("Failed to copy path");
			}
		}
	};

	// Drag and drop
	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: NODE_TYPE,
			item: { id, repositoryId, index },
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[id, repositoryId, index],
	);

	const [, drop] = useDrop({
		accept: NODE_TYPE,
		hover: (item: { id: string; repositoryId: string; index: number }) => {
			if (item.repositoryId === repositoryId && item.index !== index) {
				reorderNodes.mutate(
					{
						repositoryId,
						fromIndex: item.index,
						toIndex: index,
					},
					{
						onError: (error) =>
							toast.error(`Failed to reorder node: ${error.message}`),
					},
				);
				item.index = index;
			}
		},
	});

	const pr = githubStatus?.pr;
	// Show diff stats from PR if available, otherwise from local changes
	const diffStats =
		localDiffStats ||
		(pr && (pr.additions > 0 || pr.deletions > 0)
			? { additions: pr.additions, deletions: pr.deletions }
			: null);
	const showDiffStats = !!diffStats;

	// Determine if we should show the branch subtitle
	const showBranchSubtitle = !isBranchNode;

	// Collapsed sidebar: show just the icon with hover card (worktree) or tooltip (branch)
	if (isCollapsed) {
		const collapsedButton = (
			<button
				type="button"
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
				className={cn(
					"relative flex items-center justify-center size-8 rounded-lg",
					"hover:bg-accent transition-colors duration-150",
					isActive && "bg-accent",
				)}
			>
				{nodeStatus === "working" ? (
					<AsciiSpinner className="text-base" />
				) : isBranchNode ? (
					<LuFolder
						className={cn(
							"size-4",
							isActive ? "text-foreground" : "text-muted-foreground",
						)}
						strokeWidth={STROKE_WIDTH}
					/>
				) : (
					<LuFolderGit2
						className={cn(
							"size-4",
							isActive ? "text-foreground" : "text-muted-foreground",
						)}
						strokeWidth={STROKE_WIDTH}
					/>
				)}
				{/* Status indicator - only show for non-working statuses */}
				{nodeStatus && nodeStatus !== "working" && (
					<span className="absolute top-1 right-1">
						<StatusIndicator status={nodeStatus} />
					</span>
				)}
				{/* Unread dot (only when no status) */}
				{isUnread && !nodeStatus && (
					<span className="absolute top-1 right-1 flex size-2">
						<span className="relative inline-flex size-2 rounded-full bg-blue-500" />
					</span>
				)}
			</button>
		);

		// Branch nodes get a simple tooltip
		if (isBranchNode) {
			return (
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>{collapsedButton}</TooltipTrigger>
					<TooltipContent side="right" className="flex flex-col gap-0.5">
						<span className="font-medium">{name || branch}</span>
						<span className="text-xs text-muted-foreground">
							Local node
						</span>
					</TooltipContent>
				</Tooltip>
			);
		}

		// Worktree nodes get the full hover card with context menu
		return (
			<>
				<HoverCard
					openDelay={HOVER_CARD_OPEN_DELAY}
					closeDelay={HOVER_CARD_CLOSE_DELAY}
				>
					<ContextMenu>
						<HoverCardTrigger asChild>
							<ContextMenuTrigger asChild>{collapsedButton}</ContextMenuTrigger>
						</HoverCardTrigger>
						<ContextMenuContent>
							<ContextMenuItem onSelect={handleCopyPath}>
								<LuCopy className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
								Copy Path
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem onSelect={() => handleDeleteClick()}>
								<LuX className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
								Close Worktree
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
					<HoverCardContent side="right" align="start" className="w-72">
						<NodeHoverCardContent nodeId={id} nodeAlias={name} />
					</HoverCardContent>
				</HoverCard>
				<DeleteNodeDialog
					nodeId={id}
					nodeName={name}
					nodeType={type}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
				/>
			</>
		);
	}

	const content = (
		// biome-ignore lint/a11y/useSemanticElements: Can't use <button> because this contains nested buttons (BranchSwitcher, close button)
		<div
			role="button"
			tabIndex={0}
			ref={(node) => {
				drag(drop(node));
			}}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick();
				}
			}}
			onMouseEnter={handleMouseEnter}
			onDoubleClick={isBranchNode ? undefined : rename.startRename}
			className={cn(
				"flex items-center w-full pl-3 pr-2 text-sm mx-1.5 rounded-lg",
				"hover:bg-accent transition-colors duration-150 text-left cursor-pointer",
				"group relative",
				showBranchSubtitle ? "py-1.5" : "py-2",
				isActive && "bg-accent",
				isDragging && "opacity-30",
			)}
			style={{ cursor: isDragging ? "grabbing" : "pointer" }}
		>
			{/* Active indicator */}
			{isActive && (
				<div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r" />
			)}

			{/* Icon with status indicator */}
			<Tooltip delayDuration={500}>
				<TooltipTrigger asChild>
					<div className="relative shrink-0 size-5 flex items-center justify-center mr-2.5">
						{nodeStatus === "working" ? (
							<AsciiSpinner className="text-base" />
						) : isBranchNode ? (
							<LuFolder
								className={cn(
									"size-4 transition-colors",
									isActive ? "text-foreground" : "text-muted-foreground",
								)}
								strokeWidth={STROKE_WIDTH}
							/>
						) : (
							<LuFolderGit2
								className={cn(
									"size-4 transition-colors",
									isActive ? "text-foreground" : "text-muted-foreground",
								)}
								strokeWidth={STROKE_WIDTH}
							/>
						)}
						{nodeStatus && nodeStatus !== "working" && (
							<span className="absolute -top-0.5 -right-0.5">
								<StatusIndicator status={nodeStatus} />
							</span>
						)}
						{isUnread && !nodeStatus && (
							<span className="absolute -top-0.5 -right-0.5 flex size-2">
								<span className="relative inline-flex size-2 rounded-full bg-blue-500" />
							</span>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="right" sideOffset={8}>
					{isBranchNode ? (
						<>
							<p className="text-xs font-medium">Local node</p>
							<p className="text-xs text-muted-foreground">
								Changes are made directly in the main repository
							</p>
						</>
					) : (
						<>
							<p className="text-xs font-medium">Worktree node</p>
							<p className="text-xs text-muted-foreground">
								Isolated copy for parallel development
							</p>
						</>
					)}
				</TooltipContent>
			</Tooltip>

			{/* Content area */}
			<div className="flex-1 min-w-0">
				{rename.isRenaming ? (
					<Input
						ref={rename.inputRef}
						variant="ghost"
						value={rename.renameValue}
						onChange={(e) => rename.setRenameValue(e.target.value)}
						onBlur={rename.submitRename}
						onKeyDown={(e) => {
							e.stopPropagation();
							rename.handleKeyDown(e);
						}}
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-6 px-1 py-0 text-sm -ml-1"
					/>
				) : (
					<div className="flex flex-col gap-0.5">
						{/* Row 1: Title + actions */}
						<div className="flex items-center gap-1.5">
							<span
								className={cn(
									"truncate text-[13px] leading-tight transition-colors flex-1",
									isActive
										? "text-foreground font-medium"
										: "text-foreground/80",
								)}
							>
								{name || branch}
							</span>

							{/* Keyboard shortcut */}
							{shortcutIndex !== undefined &&
								shortcutIndex < MAX_KEYBOARD_SHORTCUT_INDEX && (
									<span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono tabular-nums shrink-0">
										⌘{shortcutIndex + 1}
									</span>
								)}

							{/* Branch switcher for branch nodes */}
							{isBranchNode && (
								<BranchSwitcher repositoryId={repositoryId} currentBranch={branch} />
							)}

							{/* Diff stats (transforms to X on hover) or close button for worktree nodes */}
							{!isBranchNode &&
								(showDiffStats && diffStats ? (
									<NodeDiffStats
										additions={diffStats.additions}
										deletions={diffStats.deletions}
										isActive={isActive}
										onClose={(e) => {
											e.stopPropagation();
											handleDeleteClick();
										}}
									/>
								) : (
									<Tooltip delayDuration={300}>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteClick();
												}}
												className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-muted-foreground hover:text-foreground"
												aria-label="Close node"
											>
												<HiMiniXMark className="size-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="top" sideOffset={4}>
											Close node
										</TooltipContent>
									</Tooltip>
								))}
						</div>

						{/* Row 2: Git info (branch + PR badge) */}
						{(showBranchSubtitle || pr) && (
							<div className="flex items-center gap-2 text-[11px] w-full">
								{showBranchSubtitle && (
									<span className="text-muted-foreground/60 truncate font-mono leading-tight">
										{branch}
									</span>
								)}
								{pr && (
									<NodeStatusBadge
										state={pr.state}
										prNumber={pr.number}
										prUrl={pr.url}
										className="ml-auto"
									/>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);

	const unreadMenuItem = (
		<ContextMenuItem onSelect={handleToggleUnread}>
			{isUnread ? (
				<>
					<LuEye className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
					Mark as Read
				</>
			) : (
				<>
					<LuEyeOff className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
					Mark as Unread
				</>
			)}
		</ContextMenuItem>
	);

	// Wrap with context menu and hover card
	if (isBranchNode) {
		return (
			<>
				<ContextMenu>
					<ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onSelect={handleOpenInFinder}>
							<LuFolderOpen
								className="size-4 mr-2"
								strokeWidth={STROKE_WIDTH}
							/>
							Open in Finder
						</ContextMenuItem>
						<ContextMenuItem onSelect={handleCopyPath}>
							<LuCopy className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
							Copy Path
						</ContextMenuItem>
						<ContextMenuSeparator />
						{unreadMenuItem}
					</ContextMenuContent>
				</ContextMenu>
				<DeleteNodeDialog
					nodeId={id}
					nodeName={name}
					nodeType={type}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
				/>
			</>
		);
	}

	return (
		<>
			<HoverCard
				openDelay={HOVER_CARD_OPEN_DELAY}
				closeDelay={HOVER_CARD_CLOSE_DELAY}
			>
				<ContextMenu>
					<HoverCardTrigger asChild>
						<ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
					</HoverCardTrigger>
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
						<ContextMenuItem onSelect={handleCopyPath}>
							<LuCopy className="size-4 mr-2" strokeWidth={STROKE_WIDTH} />
							Copy Path
						</ContextMenuItem>
						<ContextMenuSeparator />
						{unreadMenuItem}
					</ContextMenuContent>
				</ContextMenu>
				<HoverCardContent side="right" align="start" className="w-72">
					<NodeHoverCardContent nodeId={id} nodeAlias={name} />
				</HoverCardContent>
			</HoverCard>
			<DeleteNodeDialog
				nodeId={id}
				nodeName={name}
				nodeType={type}
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
			/>
		</>
	);
}
