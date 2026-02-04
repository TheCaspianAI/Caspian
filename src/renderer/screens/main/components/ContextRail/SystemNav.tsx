import { useState } from "react";
import { LuFolderGit, LuFolderOpen } from "react-icons/lu";
import { useCreateBranchNode } from "renderer/react-query/nodes";
import { useOpenNew } from "renderer/react-query/repositories";
import { Button } from "ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "ui/components/ui/dropdown-menu";
import { toast } from "ui/components/ui/sonner";
import { CloneRepoDialog } from "../StartView/CloneRepoDialog";

export function SystemNav() {
	const openNew = useOpenNew();
	const createBranchNode = useCreateBranchNode();
	const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

	const isLoading = openNew.isPending || createBranchNode.isPending;

	const handleOpenRepository = async () => {
		try {
			const result = await openNew.mutateAsync(undefined);
			if (result.canceled) {
				return;
			}
			if ("error" in result) {
				toast.error("Failed to open repository", {
					description: result.error,
				});
				return;
			}
			if ("needsGitInit" in result) {
				toast.error("Selected folder is not a git repository", {
					description: "Please use 'Open repository' from the start view to initialize git.",
				});
				return;
			}
			toast.promise(createBranchNode.mutateAsync({ repositoryId: result.repository.id }), {
				loading: "Opening repository...",
				success: "Repository opened",
				error: (err) => (err instanceof Error ? err.message : "Failed to open repository"),
			});
		} catch (error) {
			toast.error("Failed to open repository", {
				description: error instanceof Error ? error.message : "An unknown error occurred",
			});
		}
	};

	const handleCloneError = (error: string) => {
		toast.error("Failed to clone repository", {
			description: error,
		});
	};

	return (
		<>
			<div className="flex flex-col gap-0.5 px-3 py-2 mt-auto">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="w-full justify-start px-2 py-1.5 h-auto text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal"
							disabled={isLoading}
						>
							Add Repository
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start" className="w-48">
						<DropdownMenuItem
							onClick={handleOpenRepository}
							disabled={isLoading}
							className="gap-2 text-xs"
						>
							<LuFolderOpen className="size-3.5" />
							Open repository
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => setIsCloneDialogOpen(true)}
							disabled={isLoading}
							className="gap-2 text-xs"
						>
							<LuFolderGit className="size-3.5" />
							Clone repo
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<CloneRepoDialog
				isOpen={isCloneDialogOpen}
				onClose={() => setIsCloneDialogOpen(false)}
				onError={handleCloneError}
			/>
		</>
	);
}
