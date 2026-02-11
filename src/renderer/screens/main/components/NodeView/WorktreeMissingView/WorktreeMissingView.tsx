import { useState } from "react";
import { HiExclamationTriangle } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "ui/components/ui/alert-dialog";
import { Button } from "ui/components/ui/button";

interface WorktreeMissingViewProps {
	nodeId: string;
	nodeName: string;
}

export function WorktreeMissingView({ nodeId, nodeName }: WorktreeMissingViewProps) {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const deleteMutation = electronTrpc.nodes.delete.useMutation();
	const utils = electronTrpc.useUtils();

	const handleDelete = () => {
		setShowDeleteConfirm(false);
		deleteMutation.mutate(
			{ id: nodeId },
			{
				onSuccess: () => {
					utils.nodes.invalidate();
				},
			},
		);
	};

	return (
		<>
			<div className="flex flex-col items-center justify-center h-full w-full px-8">
				<div className="flex flex-col items-center max-w-sm text-center space-y-6">
					<div className="flex items-center justify-center size-16 rounded-full bg-destructive/10">
						<HiExclamationTriangle className="size-8 text-destructive" />
					</div>

					<div className="space-y-2">
						<h2 className="text-lg font-medium text-foreground">Worktree directory not found</h2>
						<p className="text-sm text-muted-foreground">{nodeName}</p>
						<p className="text-xs text-muted-foreground/80 mt-2">
							The worktree directory for this node no longer exists on disk. It may have been
							deleted from Finder, the terminal, or another tool. You can delete this node and
							create a new one from the same branch.
						</p>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowDeleteConfirm(true)}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete Node"}
					</Button>
				</div>
			</div>

			<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<AlertDialogContent className="max-w-[340px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">Delete node "{nodeName}"?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground">
								The worktree directory is already gone. This will remove the node from Caspian.
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={() => setShowDeleteConfirm(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={handleDelete}
						>
							Delete
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
