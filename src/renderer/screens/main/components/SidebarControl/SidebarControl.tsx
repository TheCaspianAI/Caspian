import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { LuPanelLeft, LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useSidebarStore } from "renderer/stores";
import { useChangesStore } from "renderer/stores/changes";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { ChangeCategory, ChangedFile } from "shared/changes-types";

/** Priority order for selecting the first file to open */
const FILE_CATEGORIES: Array<{
	key: "againstBase" | "staged" | "unstaged" | "untracked";
	category: ChangeCategory;
}> = [
	{ key: "againstBase", category: "against-base" },
	{ key: "staged", category: "staged" },
	{ key: "unstaged", category: "unstaged" },
	{ key: "untracked", category: "unstaged" },
];

export function SidebarControl() {
	const { isSidebarOpen, toggleSidebar } = useSidebarStore();

	// Get active workspace for file opening
	const { nodeId: workspaceId } = useParams({ strict: false });
	const { data: workspace } = electronTrpc.nodes.get.useQuery(
		{ id: workspaceId ?? "" },
		{ enabled: !!workspaceId },
	);
	const worktreePath = workspace?.worktreePath;

	// Get base branch for changes query
	const { baseBranch, selectFile } = useChangesStore();
	const { data: branchData } = electronTrpc.changes.getBranches.useQuery(
		{ worktreePath: worktreePath || "" },
		{ enabled: !!worktreePath && !isSidebarOpen },
	);
	const effectiveBaseBranch = baseBranch ?? branchData?.defaultBranch ?? "main";

	// Get changes status - only query when sidebar is closed (we need it to open first file)
	const { data: status } = electronTrpc.changes.getStatus.useQuery(
		{ worktreePath: worktreePath || "", defaultBranch: effectiveBaseBranch },
		{ enabled: !!worktreePath && !isSidebarOpen },
	);

	// Access tabs store for file opening
	const addFileViewerPane = useTabsStore((s) => s.addFileViewerPane);
	const trpcUtils = electronTrpc.useUtils();

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
					"[SidebarControl/invalidateFileContent] Failed to invalidate:",
					{ worktreePath, filePath, error },
				);
			});
		},
		[worktreePath, trpcUtils],
	);

	const openFirstFile = useCallback(() => {
		if (!workspaceId || !worktreePath || !status) return;

		// Find the first file in priority order
		let firstFile: ChangedFile | undefined;
		let category: ChangeCategory | undefined;

		for (const { key, category: cat } of FILE_CATEGORIES) {
			const files = status[key];
			if (files && files.length > 0) {
				firstFile = files[0];
				category = cat;
				break;
			}
		}

		if (firstFile && category) {
			selectFile(worktreePath, firstFile, category, null);
			addFileViewerPane(workspaceId, {
				filePath: firstFile.path,
				diffCategory: category,
				oldPath: firstFile.oldPath,
				isPinned: false,
			});
			invalidateFileContent(firstFile.path);
		}
	}, [
		workspaceId,
		worktreePath,
		status,
		selectFile,
		addFileViewerPane,
		invalidateFileContent,
	]);

	const handleClick = useCallback(() => {
		if (isSidebarOpen) {
			toggleSidebar();
		} else {
			toggleSidebar();
			openFirstFile();
		}
	}, [isSidebarOpen, toggleSidebar, openFirstFile]);

	const getToggleIcon = (isHovering: boolean) => {
		if (isSidebarOpen) {
			return isHovering ? (
				<LuPanelLeftClose className="size-4" strokeWidth={1.5} />
			) : (
				<LuPanelLeft className="size-4" strokeWidth={1.5} />
			);
		}
		return isHovering ? (
			<LuPanelLeftOpen className="size-4" strokeWidth={1.5} />
		) : (
			<LuPanelLeft className="size-4" strokeWidth={1.5} />
		);
	};

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={handleClick}
					aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
					aria-pressed={isSidebarOpen}
					className="no-drag group flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				>
					<span className="group-hover:hidden">{getToggleIcon(false)}</span>
					<span className="hidden group-hover:block">{getToggleIcon(true)}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" showArrow={false}>
				{isSidebarOpen ? "Hide" : "Show"}
			</TooltipContent>
		</Tooltip>
	);
}
