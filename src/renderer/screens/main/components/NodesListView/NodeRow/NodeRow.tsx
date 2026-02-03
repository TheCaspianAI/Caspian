import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useState } from "react";
import {
	LuArrowRight,
	LuFolder,
	LuFolderGit2,
	LuRotateCw,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useNodeDeleteHandler } from "renderer/react-query/nodes/useNodeDeleteHandler";
import { STROKE_WIDTH } from "../constants";
import { DeleteNodeDialog } from "../components/DeleteNodeDialog/DeleteNodeDialog";
import type { NodeItem } from "../types";
import { getRelativeTime } from "../utils";
import { DeleteWorktreeDialog } from "./DeleteWorktreeDialog";

const GITHUB_STATUS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

interface NodeRowProps {
	node: NodeItem;
	onSwitch: () => void;
	onReopen: () => void;
	isOpening?: boolean;
}

export function NodeRow({
	node,
	onSwitch,
	onReopen,
	isOpening,
}: NodeRowProps) {
	const isBranch = node.type === "branch";
	const [hasHovered, setHasHovered] = useState(false);
	const { showDeleteDialog, setShowDeleteDialog, handleDeleteClick } =
		useNodeDeleteHandler();

	// Lazy-load GitHub status on hover to avoid N+1 queries
	const { data: githubStatus } =
		electronTrpc.nodes.getGitHubStatus.useQuery(
			{ nodeId: node.nodeId ?? "" },
			{
				enabled:
					hasHovered &&
					node.type === "worktree" &&
					!!node.nodeId,
				staleTime: GITHUB_STATUS_STALE_TIME,
			},
		);

	const pr = githubStatus?.pr;
	const showDiffStats = pr && (pr.additions > 0 || pr.deletions > 0);

	const timeText = node.isOpen
		? `Opened ${getRelativeTime(node.lastOpenedAt)}`
		: `Created ${getRelativeTime(node.createdAt)}`;

	const handleClick = () => {
		if (node.isOpen) {
			onSwitch();
		} else {
			onReopen();
		}
	};

	const button = (
		<button
			type="button"
			onClick={handleClick}
			disabled={isOpening}
			onMouseEnter={() => !hasHovered && setHasHovered(true)}
			className={cn(
				"flex items-center gap-3 w-full px-4 py-2.5 group text-left",
				"hover:bg-background/50 transition-colors",
				isOpening && "opacity-50 cursor-wait",
			)}
		>
			{/* Icon */}
			<Tooltip delayDuration={500}>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center justify-center size-6 rounded shrink-0",
							!node.isOpen && "opacity-50",
						)}
					>
						{isBranch ? (
							<LuFolder
								className="size-4 text-muted-foreground"
								strokeWidth={STROKE_WIDTH}
							/>
						) : (
							<LuFolderGit2
								className="size-4 text-muted-foreground"
								strokeWidth={STROKE_WIDTH}
							/>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="top" sideOffset={4}>
					{isBranch ? (
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

			{/* Node/branch name */}
			<span
				className={cn(
					"text-sm truncate text-foreground/80",
					!node.isOpen && "text-foreground/50",
				)}
			>
				{node.name}
			</span>

			{/* Unread indicator */}
			{node.isUnread && (
				<span className="relative flex size-2 shrink-0">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
					<span className="relative inline-flex size-2 rounded-full bg-red-500" />
				</span>
			)}

			{/* Diff stats */}
			{showDiffStats && (
				<div className="flex items-center gap-1 text-caption font-mono shrink-0">
					<span className="text-emerald-500">+{pr.additions}</span>
					<span className="text-destructive-foreground">-{pr.deletions}</span>
				</div>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Time context */}
			<span className="text-caption text-foreground/40 shrink-0 group-hover:hidden">
				{timeText}
			</span>

			{/* Action indicator - visible on hover */}
			<div className="hidden group-hover:flex items-center gap-1.5 text-xs shrink-0">
				{isOpening ? (
					<>
						<LuRotateCw className="size-3 animate-spin text-foreground/60" />
						<span className="text-foreground/60">Opening...</span>
					</>
				) : node.isOpen ? (
					<>
						<span className="font-medium text-foreground/80">Switch to</span>
						<LuArrowRight className="size-3 text-foreground/80" />
					</>
				) : (
					<>
						<span className="font-medium text-foreground/80">Reopen</span>
						<LuArrowRight className="size-3 text-foreground/80" />
					</>
				)}
			</div>
		</button>
	);

	// Determine the delete/close action label based on node type and state
	const isOpenNode = node.nodeId !== null;
	const isClosedWorktree = !isOpenNode && node.worktreeId !== null;
	const actionLabel = isBranch
		? "Close node"
		: isClosedWorktree
			? "Delete worktree"
			: "Delete node";

	// Can delete open nodes or closed worktrees
	const canDelete = isOpenNode || isClosedWorktree;

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem
						onSelect={() => handleDeleteClick()}
						className="text-destructive focus:text-destructive"
						disabled={!canDelete}
					>
						{actionLabel}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			{/* Dialog for open nodes */}
			{node.nodeId && (
				<DeleteNodeDialog
					nodeId={node.nodeId}
					nodeName={node.name}
					nodeType={node.type}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
				/>
			)}

			{/* Dialog for closed worktrees */}
			{isClosedWorktree && node.worktreeId && (
				<DeleteWorktreeDialog
					worktreeId={node.worktreeId}
					worktreeName={node.name}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
				/>
			)}
		</>
	);
}
