import type { ComponentPropsWithoutRef, Ref } from "react";
import { useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { LuFolderGit2, LuLaptop, LuRotateCw, LuX } from "react-icons/lu";
import { PLATFORM } from "shared/constants";
import type { ActivePaneStatus } from "shared/tabs-types";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { AsciiSpinner } from "../../AsciiSpinner";
import type { NodeItem } from "../../NodesListView/types";
import { NodeDiffStats } from "./NodeDiffStats";

export const NODE_TYPE = "SIDEBAR_NODE";

interface NodeDragItem {
	nodeId: string;
	repositoryId: string;
	index: number;
	originalIndex: number;
}

interface SidebarNodeRowProps extends Omit<ComponentPropsWithoutRef<"button">, "onSelect"> {
	node: NodeItem;
	isActive: boolean;
	onSelect: () => void;
	onClose?: () => void;
	isOpening?: boolean;
	shortcutIndex?: number;
	index?: number;
	onHoverReorder?: (repositoryId: string, dragIndex: number, hoverIndex: number) => void;
	onDropReorder?: (repositoryId: string, originalIndex: number, finalIndex: number) => void;
	nodeStatus?: ActivePaneStatus | null;
	onStartRename?: () => void;
	isRenaming?: boolean;
	renameValue?: string;
	onRenameChange?: (value: string) => void;
	onRenameSubmit?: () => void;
	onRenameCancel?: () => void;
	ref?: Ref<HTMLButtonElement>;
}

function formatShortcut(index: number): string {
	const key = index + 1;
	return PLATFORM.IS_MAC ? `\u2318${key}` : `Ctrl+Shift+${key}`;
}

export function SidebarNodeRow({
	node,
	isActive,
	onSelect,
	onClose,
	isOpening,
	shortcutIndex,
	index,
	onHoverReorder,
	onDropReorder,
	nodeStatus,
	onStartRename,
	isRenaming,
	renameValue,
	onRenameChange,
	onRenameSubmit,
	onRenameCancel,
	className: externalClassName,
	ref: externalRef,
	...rest
}: SidebarNodeRowProps) {
	const isBranch = node.type === "branch";
	const showBranch = isBranch || node.branch !== node.name;
	const isDraggable = index !== undefined && node.isOpen && !!onHoverReorder;

	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: NODE_TYPE,
			item: (): NodeDragItem => ({
				nodeId: node.uniqueId,
				repositoryId: node.repositoryId,
				index: index ?? 0,
				originalIndex: index ?? 0,
			}),
			canDrag: isDraggable,
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
			end: (item) => {
				if (item && item.originalIndex !== item.index) {
					onDropReorder?.(item.repositoryId, item.originalIndex, item.index);
				}
			},
		}),
		[node.uniqueId, node.repositoryId, index, isDraggable, onDropReorder],
	);

	const [, drop] = useDrop(
		() => ({
			accept: NODE_TYPE,
			hover: (item: NodeDragItem) => {
				if (
					item.repositoryId !== node.repositoryId ||
					index === undefined ||
					item.index === index
				) {
					return;
				}
				onHoverReorder?.(item.repositoryId, item.index, index);
				item.index = index;
			},
		}),
		[node.repositoryId, index, onHoverReorder],
	);

	// Compose drag, drop, and external refs into a single callback ref
	const composedRef = useCallback(
		(element: HTMLButtonElement | null) => {
			if (isDraggable) {
				drag(drop(element));
			} else if (index !== undefined) {
				drop(element);
			}
			if (typeof externalRef === "function") externalRef(element);
			else if (externalRef)
				(externalRef as React.MutableRefObject<HTMLButtonElement | null>).current = element;
		},
		[drag, drop, isDraggable, index, externalRef],
	);

	return (
		<button
			ref={composedRef}
			type="button"
			onClick={onSelect}
			onDoubleClick={
				!isBranch && onStartRename
					? (e) => {
							e.preventDefault();
							onStartRename();
						}
					: undefined
			}
			disabled={isOpening}
			className={cn(
				"group relative flex items-start gap-2 w-full pl-7 pr-3 text-left",
				showBranch ? "py-1" : "py-1.5",
				"transition-colors duration-[80ms]",
				isActive ? "bg-accent/60 text-foreground" : "text-nav-foreground hover:bg-muted/40",
				!node.isOpen && "opacity-50",
				isOpening && "cursor-wait",
				isDragging && "opacity-30",
				externalClassName,
			)}
			{...rest}
		>
			{/* Active left border indicator */}
			{isActive && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />}

			{/* Icon with type tooltip */}
			<Tooltip delayDuration={500}>
				<TooltipTrigger asChild>
					<span className="mt-0.5 shrink-0">
						{nodeStatus === "working" ? (
							<AsciiSpinner className="text-sm" />
						) : isBranch ? (
							<LuLaptop className="size-3.5 text-muted-foreground" />
						) : (
							<LuFolderGit2 className="size-3.5 text-muted-foreground" />
						)}
					</span>
				</TooltipTrigger>
				<TooltipContent side="right" sideOffset={8}>
					{isBranch ? (
						<>
							<p className="text-xs font-medium">Local workspace</p>
							<p className="text-xs text-muted-foreground">
								Changes are made directly in the main repository
							</p>
						</>
					) : (
						<>
							<p className="text-xs font-medium">Worktree workspace</p>
							<p className="text-xs text-muted-foreground">
								Isolated copy for parallel development
							</p>
						</>
					)}
				</TooltipContent>
			</Tooltip>

			{/* Name + branch */}
			<div className="flex flex-col min-w-0 flex-1">
				{isRenaming ? (
					<input
						ref={(el) => el?.focus()}
						value={renameValue}
						onChange={(e) => onRenameChange?.(e.target.value)}
						onBlur={onRenameSubmit}
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Enter") onRenameSubmit?.();
							if (e.key === "Escape") onRenameCancel?.();
						}}
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-5 px-1 py-0 text-body bg-transparent border border-border rounded outline-none focus:border-primary w-full min-w-0"
					/>
				) : (
					<span className="text-body truncate leading-tight">{isBranch ? "local" : node.name}</span>
				)}
				{showBranch && (
					<span className="text-[11px] font-mono text-muted-foreground/60 truncate leading-tight">
						{node.branch}
					</span>
				)}
			</div>

			{/* Diff stats (PR additions/deletions) */}
			{node.isOpen && node.nodeId && (
				<span className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
					<NodeDiffStats nodeId={node.nodeId} />
				</span>
			)}

			{/* Keyboard shortcut hint (on hover) */}
			{shortcutIndex !== undefined && shortcutIndex < 9 && (
				<span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 mt-0.5">
					{formatShortcut(shortcutIndex)}
				</span>
			)}

			{/* Close button (on hover) */}
			{node.isOpen && node.nodeId && onClose && !isOpening && !isBranch && (
				<button
					type="button"
					tabIndex={-1}
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
				>
					<LuX className="size-3" />
				</button>
			)}

			{/* Loading spinner */}
			{isOpening && (
				<LuRotateCw className="size-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />
			)}

			{/* Unread indicator */}
			{node.isUnread && !isOpening && (
				<span className="relative flex size-1.5 shrink-0 mt-1.5">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
					<span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
				</span>
			)}
		</button>
	);
}
