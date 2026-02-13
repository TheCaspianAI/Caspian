import { type DragEvent, useCallback, useState } from "react";
import { LuFolderOpen } from "react-icons/lu";
import { InitGitDialog } from "renderer/components/InitGitDialog";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useCreateBranchNode } from "renderer/react-query/nodes";
import { toast } from "ui/components/ui/sonner";
import { cn } from "ui/lib/utils";

export function FolderDropZone() {
	const [isDragOver, setIsDragOver] = useState(false);
	const [initGitDialog, setInitGitDialog] = useState<{ isOpen: boolean; selectedPath: string }>({
		isOpen: false,
		selectedPath: "",
	});
	const openFromPath = electronTrpc.repositories.openFromPath.useMutation();
	const createBranchNode = useCreateBranchNode();
	const isLoading = openFromPath.isPending || createBranchNode.isPending;

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);

			const file = e.dataTransfer.files[0];
			if (!file) return;

			const path = window.webUtils?.getPathForFile(file);
			if (!path) {
				toast.error("Could not determine folder path");
				return;
			}

			try {
				const result = await openFromPath.mutateAsync({ path });

				if ("error" in result) {
					toast.error("Failed to open repository", {
						description: result.error,
					});
					return;
				}

				if ("needsGitInit" in result) {
					setInitGitDialog({ isOpen: true, selectedPath: result.selectedPath });
					return;
				}

				if ("canceled" in result && result.canceled) {
					return;
				}

				if ("repository" in result) {
					toast.promise(createBranchNode.mutateAsync({ repositoryId: result.repository.id }), {
						loading: "Opening repository...",
						success: "Repository opened",
						error: (err) => (err instanceof Error ? err.message : "Failed to open repository"),
					});
				}
			} catch (error) {
				toast.error("Failed to open repository", {
					description: error instanceof Error ? error.message : "An unknown error occurred",
				});
			}
		},
		[openFromPath, createBranchNode],
	);

	return (
		<>
			<section
				aria-label="Drop folder to add repository"
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"mx-3 mb-2 rounded-md border border-dashed transition-colors duration-[80ms]",
					isDragOver
						? "border-primary/60 bg-primary/5 text-foreground"
						: "border-transparent text-transparent",
					isLoading && "opacity-50 pointer-events-none",
				)}
			>
				<div className="flex items-center justify-center gap-1.5 py-2 text-caption">
					<LuFolderOpen className="size-3" />
					<span>Drop folder to add repo</span>
				</div>
			</section>

			<InitGitDialog
				isOpen={initGitDialog.isOpen}
				selectedPath={initGitDialog.selectedPath}
				onClose={() => setInitGitDialog({ isOpen: false, selectedPath: "" })}
				onSuccess={(repository) => {
					toast.promise(createBranchNode.mutateAsync({ repositoryId: repository.id }), {
						loading: "Opening repository...",
						success: "Repository opened",
						error: (err) => (err instanceof Error ? err.message : "Failed to open repository"),
					});
				}}
				onError={(error) => {
					toast.error("Failed to initialize git repository", { description: error });
				}}
			/>
		</>
	);
}
