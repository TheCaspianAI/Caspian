import { cn } from "ui/lib/utils";
import { Button } from "ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { LuExpand, LuShrink, LuX } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useChangesStore } from "renderer/stores/changes";
import {
	RightSidebarTab,
	SidebarMode,
	useSidebarStore,
} from "renderer/stores/sidebar-state";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { ChangeCategory, ChangedFile } from "shared/changes-types";
import { useScrollContext } from "../NodeView/ChangesContent";
import { ChangesView } from "./ChangesView";
import { FilesView } from "./FilesView";

function TabButton({
	isActive,
	onClick,
	label,
}: {
	isActive: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"h-7 px-2 text-xs rounded transition-colors",
				isActive
					? "text-foreground bg-accent/40"
					: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
			)}
		>
			{label}
		</button>
	);
}

export function FilesChangesPane() {
	const { nodeId } = useParams({ strict: false });
	const { data: node } = electronTrpc.nodes.get.useQuery(
		{ id: nodeId ?? "" },
		{ enabled: !!nodeId },
	);
	const worktreePath = node?.worktreePath;
	const { baseBranch } = useChangesStore();
	const { data: branchData } = electronTrpc.changes.getBranches.useQuery(
		{ worktreePath: worktreePath || "" },
		{ enabled: !!worktreePath },
	);
	const effectiveBaseBranch = baseBranch ?? branchData?.defaultBranch ?? "main";
	const { data: status } = electronTrpc.changes.getStatus.useQuery(
		{ worktreePath: worktreePath || "", defaultBranch: effectiveBaseBranch },
		{
			enabled: !!worktreePath,
			refetchInterval: 2500,
			refetchOnWindowFocus: true,
		},
	);
	const {
		currentMode,
		rightSidebarTab,
		setRightSidebarTab,
		toggleSidebar,
		setMode,
	} = useSidebarStore();
	const isExpanded = currentMode === SidebarMode.Changes;
	const hasChanges = status
		? (status.againstBase?.length ?? 0) > 0 ||
			(status.commits?.length ?? 0) > 0 ||
			(status.staged?.length ?? 0) > 0 ||
			(status.unstaged?.length ?? 0) > 0 ||
			(status.untracked?.length ?? 0) > 0
		: true;
	const showChangesTab = !!worktreePath && hasChanges;

	useEffect(() => {
		if (!showChangesTab && rightSidebarTab === RightSidebarTab.Changes) {
			setRightSidebarTab(RightSidebarTab.Files);
		}
	}, [rightSidebarTab, setRightSidebarTab, showChangesTab]);

	const handleExpandToggle = () => {
		setMode(isExpanded ? SidebarMode.Tabs : SidebarMode.Changes);
	};

	const addFileViewerPane = useTabsStore((s) => s.addFileViewerPane);
	const trpcUtils = electronTrpc.useUtils();
	const scrollContext = useScrollContext();
	const scrollToFile = scrollContext?.scrollToFile;

	const invalidateFileContent = useCallback(
		(filePath: string) => {
			if (!worktreePath) return;

			Promise.all([
				trpcUtils.changes.readWorkingFile.invalidate({
					worktreePath,
					filePath,
				}),
				trpcUtils.changes.getFileContents.invalidate({
					worktreePath,
					filePath,
				}),
			]).catch((error) => {
				console.error(
					"[FilesChangesPane/invalidateFileContent] Failed to invalidate file content queries:",
					{ worktreePath, filePath, error },
				);
			});
		},
		[worktreePath, trpcUtils],
	);

	const handleFileOpenPane = useCallback(
		(file: ChangedFile, category: ChangeCategory, commitHash?: string) => {
			if (!nodeId || !worktreePath) return;
			addFileViewerPane(nodeId, {
				filePath: file.path,
				diffCategory: category,
				commitHash,
				oldPath: file.oldPath,
				forceNewTab: true,
			});
			invalidateFileContent(file.path);
		},
		[nodeId, worktreePath, addFileViewerPane, invalidateFileContent],
	);

	const handleFileScrollTo = useCallback(
		(file: ChangedFile, category: ChangeCategory, commitHash?: string) => {
			scrollToFile?.(file, category, commitHash);
		},
		[scrollToFile],
	);

	const handleFileOpen =
		nodeId && worktreePath
			? isExpanded
				? handleFileScrollTo
				: handleFileOpenPane
			: undefined;

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<div className="flex items-center gap-1 px-3 py-1.5">
				{showChangesTab && (
					<TabButton
						isActive={rightSidebarTab === RightSidebarTab.Changes}
						onClick={() => setRightSidebarTab(RightSidebarTab.Changes)}
						label="Changes"
					/>
				)}
				<TabButton
					isActive={rightSidebarTab === RightSidebarTab.Files}
					onClick={() => setRightSidebarTab(RightSidebarTab.Files)}
					label="Files"
				/>
				<div className="flex-1" />
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleExpandToggle}
							className="size-6 p-0"
						>
							{isExpanded ? (
								<LuShrink className="size-3.5" />
							) : (
								<LuExpand className="size-3.5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" showArrow={false}>
						{isExpanded ? "Collapse" : "Expand"}
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleSidebar}
							className="size-6 p-0"
						>
							<LuX className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" showArrow={false}>
						<HotkeyTooltipContent label="Close" hotkeyId="TOGGLE_NODE_SIDEBAR" />
					</TooltipContent>
				</Tooltip>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden">
				{rightSidebarTab === RightSidebarTab.Changes && showChangesTab ? (
					<ChangesView onFileOpen={handleFileOpen} isExpandedView={isExpanded} />
				) : (
					<FilesView />
				)}
			</div>
		</div>
	);
}
