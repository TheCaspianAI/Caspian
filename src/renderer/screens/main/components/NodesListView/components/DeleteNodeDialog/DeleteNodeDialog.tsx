import { electronTrpc } from "renderer/lib/electron-trpc";
import { useDeleteNode } from "renderer/react-query/nodes";
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

interface DeleteNodeDialogProps {
	nodeId: string;
	nodeName: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteNodeDialog({ nodeId, nodeName, open, onOpenChange }: DeleteNodeDialogProps) {
	const deleteNode = useDeleteNode();

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

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-[340px] gap-0 p-0">
				<AlertDialogHeader className="px-4 pt-4 pb-2">
					<AlertDialogTitle className="font-medium">Delete node "{nodeName}"?</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="text-muted-foreground space-y-1.5">
							{isLoading ? (
								"Checking status..."
							) : !canDelete ? (
								<span className="text-destructive">{reason}</span>
							) : (
								<span className="block">
									This will permanently remove the node, its worktree, and kill any active
									terminals. Your branch and commits will remain in the repository.
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
						variant="destructive"
						size="sm"
						className="h-7 px-3 text-xs"
						onClick={handleDelete}
						disabled={!canDelete || isLoading}
					>
						Delete
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
