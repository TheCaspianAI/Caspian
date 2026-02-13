import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
	LuChevronDown,
	LuCopy,
	LuFolderGit2,
	LuFolderOpen,
	LuLaptop,
	LuPlus,
	LuX,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useTabsStore } from "renderer/stores/tabs/store";
import { extractPaneIdsFromLayout } from "renderer/stores/tabs/utils";
import type { ActivePaneStatus } from "shared/tabs-types";
import { getHighestPriorityStatus } from "shared/tabs-types";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import { toast } from "ui/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { AsciiSpinner } from "../../AsciiSpinner";
import { DeleteNodeDialog } from "../../NodesListView/components/DeleteNodeDialog/DeleteNodeDialog";
import type { NodeItem, RepositoryGroup } from "../../NodesListView/types";
import { NodeHoverCard } from "./NodeHoverCard";
import { SidebarNodeContextMenu } from "./SidebarNodeContextMenu";
import { SidebarNodeRow } from "./SidebarNodeRow";

export const REPO_SECTION_TYPE = "REPO_SECTION";

interface RepoSectionDragItem {
	repositoryId: string;
	index: number;
	originalIndex: number;
}

interface RepositorySectionProps {
	group: RepositoryGroup;
	index: number;
	activeNodeId: string | null;
	onNodeSelect: (node: NodeItem) => void;
	openingWorktreeId: string | null;
	shortcutIndexMap: Map<string, number>;
	isCollapsed?: boolean;
	onNodeHoverReorder?: (repositoryId: string, dragIndex: number, hoverIndex: number) => void;
	onNodeDropReorder?: (repositoryId: string, originalIndex: number, finalIndex: number) => void;
	onRepoHoverReorder?: (dragIndex: number, hoverIndex: number) => void;
	onRepoDropReorder?: (originalIndex: number, finalIndex: number) => void;
}

export function RepositorySection({
	group,
	index,
	activeNodeId,
	onNodeSelect,
	openingWorktreeId,
	shortcutIndexMap,
	isCollapsed: isSidebarCollapsed,
	onNodeHoverReorder,
	onNodeDropReorder,
	onRepoHoverReorder,
	onRepoDropReorder,
}: RepositorySectionProps) {
	const [isSectionCollapsed, setIsSectionCollapsed] = useState(false);
	const [closingNode, setClosingNode] = useState<NodeItem | null>(null);
	const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const openNewNodeModal = useOpenNewNodeModal();
	const sectionRef = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const openInFinder = electronTrpc.external.openInFinder.useMutation();
	const closeRepo = electronTrpc.repositories.close.useMutation({
		onSuccess: async () => {
			await utils.repositories.invalidate();
			await utils.nodes.invalidate();
			if (activeNodeId && group.nodes.some((n) => n.nodeId === activeNodeId)) {
				navigate({ to: "/" });
			}
		},
		onError: (error) => {
			toast.error("Failed to close repository", { description: error.message });
		},
	});

	const updateNode = electronTrpc.nodes.update.useMutation({
		onSuccess: () => {
			utils.nodes.getAllGrouped.invalidate();
			setRenamingNodeId(null);
		},
		onError: (error) => {
			toast.error(`Failed to rename: ${error.message}`);
			setRenamingNodeId(null);
		},
	});

	const startRename = (node: NodeItem) => {
		if (node.nodeId && node.type !== "branch") {
			setRenamingNodeId(node.nodeId);
			setRenameValue(node.name);
		}
	};

	const submitRename = () => {
		if (renamingNodeId && renameValue.trim()) {
			updateNode.mutate({ id: renamingNodeId, patch: { name: renameValue.trim() } });
		} else {
			setRenamingNodeId(null);
		}
	};

	// Compute node status from pane statuses
	const tabs = useTabsStore((s) => s.tabs);
	const panes = useTabsStore((s) => s.panes);

	const getNodeStatus = useCallback(
		(nodeId: string | null): ActivePaneStatus | null => {
			if (!nodeId) return null;
			const nodeTabs = tabs.filter((t) => t.nodeId === nodeId);
			function* paneStatuses() {
				for (const tab of nodeTabs) {
					const paneIds = extractPaneIdsFromLayout(tab.layout);
					for (const paneId of paneIds) {
						yield panes[paneId]?.status;
					}
				}
			}
			return getHighestPriorityStatus(paneStatuses());
		},
		[tabs, panes],
	);

	// Memoize node statuses for all nodes in this group
	const nodeStatusMap = useMemo(() => {
		const map = new Map<string, ActivePaneStatus | null>();
		for (const node of group.nodes) {
			if (node.nodeId) {
				map.set(node.nodeId, getNodeStatus(node.nodeId));
			}
		}
		return map;
	}, [group.nodes, getNodeStatus]);

	const isDraggable = !isSidebarCollapsed && !!onRepoHoverReorder;

	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: REPO_SECTION_TYPE,
			item: (): RepoSectionDragItem => ({
				repositoryId: group.repositoryId,
				index,
				originalIndex: index,
			}),
			canDrag: isDraggable,
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
			end: (item) => {
				if (item && item.originalIndex !== item.index) {
					onRepoDropReorder?.(item.originalIndex, item.index);
				}
			},
		}),
		[group.repositoryId, index, isDraggable, onRepoDropReorder],
	);

	const [, drop] = useDrop(
		() => ({
			accept: REPO_SECTION_TYPE,
			hover: (item: RepoSectionDragItem) => {
				if (item.index === index) return;
				onRepoHoverReorder?.(item.index, index);
				item.index = index;
			},
		}),
		[index, onRepoHoverReorder],
	);

	const composedSectionRef = useCallback(
		(element: HTMLDivElement | null) => {
			if (isDraggable) {
				drag(drop(element));
			} else {
				drop(element);
			}
			(sectionRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
		},
		[drag, drop, isDraggable],
	);

	// Collapsed sidebar: show only icon-only node buttons
	if (isSidebarCollapsed) {
		return (
			<div className="flex flex-col items-center gap-0.5 py-1 border-b border-border/40 last:border-b-0">
				{/* Repo color letter */}
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className="size-5 rounded-[4px] shrink-0 my-1 flex items-center justify-center text-[10px] font-semibold text-white/90"
							style={{ backgroundColor: group.repositoryColor }}
						>
							{group.repositoryName.charAt(0).toUpperCase()}
						</span>
					</TooltipTrigger>
					<TooltipContent side="right">{group.repositoryName}</TooltipContent>
				</Tooltip>

				{/* Collapsed node icons */}
				{group.nodes.map((node) => {
					const nodeStatus = node.nodeId ? (nodeStatusMap.get(node.nodeId) ?? null) : null;
					return (
						<Tooltip key={node.uniqueId}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => onNodeSelect(node)}
									className={cn(
										"relative flex items-center justify-center size-8 rounded-md transition-colors duration-[80ms]",
										node.nodeId === activeNodeId
											? "bg-accent/60 text-foreground"
											: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
										!node.isOpen && "opacity-50",
									)}
								>
									{node.nodeId === activeNodeId && (
										<span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />
									)}
									{nodeStatus === "working" ? (
										<AsciiSpinner className="text-sm" />
									) : node.type === "branch" ? (
										<LuLaptop className="size-3.5" />
									) : (
										<LuFolderGit2 className="size-3.5" />
									)}
									{node.isUnread && (
										<span className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500" />
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">
								{node.type === "branch" ? "local" : node.name}
							</TooltipContent>
						</Tooltip>
					);
				})}
			</div>
		);
	}

	// Expanded sidebar: full layout
	return (
		<div
			ref={composedSectionRef}
			className={cn("border-b border-border/40 last:border-b-0", isDragging && "opacity-30")}
		>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<button
						type="button"
						onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
						className="group flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors duration-[80ms]"
					>
						<LuChevronDown
							className={cn(
								"size-3 text-muted-foreground shrink-0 transition-transform duration-[80ms]",
								isSectionCollapsed && "-rotate-90",
							)}
						/>
						<span
							className="size-5 rounded-[4px] shrink-0 flex items-center justify-center text-[10px] font-semibold text-white/90"
							style={{ backgroundColor: group.repositoryColor }}
						>
							{group.repositoryName.charAt(0).toUpperCase()}
						</span>
						<span className="text-body font-medium text-foreground truncate flex-1">
							{group.repositoryName}
						</span>
						<span className="text-caption text-muted-foreground/50 shrink-0">
							{group.nodes.length}
						</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										openNewNodeModal(group.repositoryId);
									}}
									className="opacity-0 group-hover:opacity-100 transition-opacity duration-[80ms] text-muted-foreground hover:text-foreground shrink-0"
								>
									<LuPlus className="size-3.5" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">New node</TooltipContent>
						</Tooltip>
					</button>
				</ContextMenuTrigger>
				<ContextMenuContent className="w-48">
					<ContextMenuItem
						onClick={() => {
							if (group.repositoryPath) openInFinder.mutate(group.repositoryPath);
						}}
						disabled={!group.repositoryPath}
						className="gap-2 text-xs"
					>
						<LuFolderOpen className="size-3.5" />
						Reveal in Finder
					</ContextMenuItem>
					<ContextMenuItem
						onClick={async () => {
							if (group.repositoryPath) {
								await navigator.clipboard.writeText(group.repositoryPath);
								toast.success("Path copied to clipboard");
							}
						}}
						disabled={!group.repositoryPath}
						className="gap-2 text-xs"
					>
						<LuCopy className="size-3.5" />
						Copy Path
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={() => closeRepo.mutate({ id: group.repositoryId })}
						className="gap-2 text-xs text-destructive focus:text-destructive"
					>
						<LuX className="size-3.5" />
						Close Repository
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<AnimatePresence initial={false}>
				{!isSectionCollapsed && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="pb-1">
							{group.nodes.map((node, nodeIndex) => {
								const handleClose =
									node.isOpen && node.nodeId && node.type !== "branch"
										? () => setClosingNode(node)
										: undefined;
								const handleRename =
									node.type !== "branch" && node.nodeId ? () => startRename(node) : undefined;
								const nodeStatus = node.nodeId ? (nodeStatusMap.get(node.nodeId) ?? null) : null;
								const row = (
									<SidebarNodeContextMenu
										key={node.uniqueId}
										node={node}
										onClose={handleClose}
										onRename={handleRename}
									>
										<SidebarNodeRow
											node={node}
											isActive={node.nodeId === activeNodeId}
											onSelect={() => onNodeSelect(node)}
											onClose={handleClose}
											isOpening={
												openingWorktreeId !== null && openingWorktreeId === node.worktreeId
											}
											shortcutIndex={node.nodeId ? shortcutIndexMap.get(node.nodeId) : undefined}
											index={nodeIndex}
											onHoverReorder={onNodeHoverReorder}
											onDropReorder={onNodeDropReorder}
											nodeStatus={nodeStatus}
											onStartRename={handleRename}
											isRenaming={renamingNodeId === node.nodeId}
											renameValue={renameValue}
											onRenameChange={setRenameValue}
											onRenameSubmit={submitRename}
											onRenameCancel={() => setRenamingNodeId(null)}
										/>
									</SidebarNodeContextMenu>
								);

								if (node.nodeId && node.type === "worktree") {
									return (
										<NodeHoverCard key={node.uniqueId} nodeId={node.nodeId} nodeName={node.name}>
											{row}
										</NodeHoverCard>
									);
								}

								return row;
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{closingNode?.nodeId && (
				<DeleteNodeDialog
					nodeId={closingNode.nodeId}
					nodeName={closingNode.name}
					open={!!closingNode}
					onOpenChange={(open) => {
						if (!open) setClosingNode(null);
					}}
				/>
			)}
		</div>
	);
}
