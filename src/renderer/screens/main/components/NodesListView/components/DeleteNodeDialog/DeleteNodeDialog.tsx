import { electronTrpc } from "renderer/lib/electron-trpc";
import { useCloseNode, useDeleteNode } from "renderer/react-query/nodes";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "ui/components/ui/alert-dialog";
import { Button } from "ui/components/ui/button";
import { toast } from "ui/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";

interface DeleteNodeDialogProps {
	nodeId: string;
	nodeName: string;
	nodeType?: "worktree" | "branch";
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteNodeDialog({
	nodeId,
	nodeName,
	nodeType = "worktree",
	open,
	onOpenChange,
}: DeleteNodeDialogProps) {
	const isBranch = nodeType === "branch";
	const deleteNode = useDeleteNode();
	const closeNode = useCloseNode();

	const { data: gitStatusData, isLoading: isLoadingGitStatus } =
		electronTrpc.nodes.canDelete.useQuery(
			{ id: nodeId },
			{
				enabled: open,
				staleTime: Number.POSITIVE_INFINITY,
			},
		);

	const { data: terminalCountData } = electronTrpc.nodes.canDelete.useQuery(
		{ id: nodeId, skipGitChecks: true },
		{
			enabled: open,
			refetchInterval: open ? 2000 : false,
		},
	);

	const canDeleteData = gitStatusData
		? {
				...gitStatusData,
				activeTerminalCount:
					terminalCountData?.activeTerminalCount ?? gitStatusData.activeTerminalCount,
			}
		: terminalCountData;
	const isLoading = isLoadingGitStatus;

	const handleClose = () => {
		onOpenChange(false);

		toast.promise(closeNode.mutateAsync({ id: nodeId }), {
			loading: "Hiding...",
			success: (result) => {
				if (result.terminalWarning) {
					setTimeout(() => {
						toast.warning("Terminal warning", {
							description: result.terminalWarning,
						});
					}, 100);
				}
				return "Node hidden";
			},
			error: (error) => (error instanceof Error ? error.message : "Failed to hide"),
		});
	};

	const handleDelete = () => {
		onOpenChange(false);

		toast.promise(deleteNode.mutateAsync({ id: nodeId }), {
			loading: `Deleting "${nodeName}"...`,
			success: (result) => {
				if (result.terminalWarning) {
					setTimeout(() => {
						toast.warning("Terminal warning", {
							description: result.terminalWarning,
						});
					}, 100);
				}
				return `Deleted "${nodeName}"`;
			},
			error: (error) => (error instanceof Error ? error.message : "Failed to delete"),
		});
	};

	const canDelete = canDeleteData?.canDelete ?? true;
	const reason = canDeleteData?.reason;
	const hasChanges = canDeleteData?.hasChanges ?? false;
	const hasUnpushedCommits = canDeleteData?.hasUnpushedCommits ?? false;
	const hasWarnings = hasChanges || hasUnpushedCommits;

	// For branch nodes, use simplified dialog (only close option)
	if (isBranch) {
		return (
			<AlertDialog open={open} onOpenChange={onOpenChange}>
				<AlertDialogContent className="max-w-[340px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">Close node "{nodeName}"?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									This will close the node and kill any active terminals. Your branch and commits
									will remain in the repository.
								</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							variant="secondary"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={handleClose}
						>
							Close
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-[340px] gap-0 p-0">
				<AlertDialogHeader className="px-4 pt-4 pb-2">
					<AlertDialogTitle className="font-medium">Remove node "{nodeName}"?</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="text-muted-foreground space-y-1.5">
							{isLoading ? (
								"Checking status..."
							) : !canDelete ? (
								<span className="text-destructive">{reason}</span>
							) : (
								<span className="block">
									Deleting will permanently remove the worktree. You can hide instead to keep files
									on disk.
								</span>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>

				{!isLoading && canDelete && hasWarnings && (
					<div className="px-4 pb-2">
						<div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
							{hasChanges && hasUnpushedCommits
								? "Has uncommitted changes and unpushed commits"
								: hasChanges
									? "Has uncommitted changes"
									: "Has unpushed commits"}
						</div>
					</div>
				)}

				<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-3 text-xs"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						variant="secondary"
						size="sm"
						className="h-7 px-3 text-xs"
						onClick={handleClose}
						disabled={isLoading}
					>
						Hide
					</Button>
					<Tooltip delayDuration={400}>
						<TooltipTrigger asChild>
							<Button
								variant="destructive"
								size="sm"
								className="h-7 px-3 text-xs"
								onClick={handleDelete}
								disabled={!canDelete || isLoading}
							>
								Delete
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-xs max-w-[200px]">
							Permanently delete node and git worktree from disk.
						</TooltipContent>
					</Tooltip>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
