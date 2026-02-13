import { useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useChangesStore } from "renderer/stores/changes";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { ChangeCategory, ChangedFile } from "shared/changes-types";
import { ChangesView } from "../../ContextRail/ChangesView";

export function ChangesPanel() {
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

	// Keep git status cache warm with polling
	electronTrpc.changes.getStatus.useQuery(
		{ worktreePath: worktreePath || "", defaultBranch: effectiveBaseBranch },
		{
			enabled: !!worktreePath,
			refetchInterval: 2500,
			refetchOnWindowFocus: true,
		},
	);

	const addFileViewerPane = useTabsStore((s) => s.addFileViewerPane);
	const trpcUtils = electronTrpc.useUtils();

	const invalidateFileContent = useCallback(
		(filePath: string) => {
			if (!worktreePath) return;
			Promise.all([
				trpcUtils.changes.readWorkingFile.invalidate({ worktreePath, filePath }),
				trpcUtils.changes.getFileContents.invalidate({ worktreePath, filePath }),
			]).catch((error) => {
				console.error("[ChangesPanel/invalidateFileContent] Failed to invalidate:", {
					worktreePath,
					filePath,
					error,
				});
			});
		},
		[worktreePath, trpcUtils],
	);

	const handleFileOpen = useCallback(
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

	if (!nodeId) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-caption">
				Open a node to get started
			</div>
		);
	}

	if (!worktreePath) {
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden items-center justify-center text-muted-foreground text-caption p-4">
				No worktree available for this node
			</div>
		);
	}

	return <ChangesView onFileOpen={handleFileOpen} isExpandedView={false} />;
}
