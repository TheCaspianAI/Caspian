import { Button } from "ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "ui/components/ui/dropdown-menu";
import { toast } from "ui/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useState } from "react";
import { LuFolderGit, LuFolderOpen, LuFolderPlus } from "react-icons/lu";
import { useOpenNew } from "renderer/react-query/repositories";
import { useCreateBranchNode } from "renderer/react-query/nodes";
import { CloneRepoDialog } from "../StartView/CloneRepoDialog";
import { STROKE_WIDTH } from "./constants";

interface NodeSidebarFooterProps {
	isCollapsed?: boolean;
}

export function NodeSidebarFooter({
	isCollapsed = false,
}: NodeSidebarFooterProps) {
	const openNew = useOpenNew();
	const createBranchNode = useCreateBranchNode();
	const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

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
					description:
						"Please use 'Open repository' from the start view to initialize git.",
				});
				return;
			}
			// Create a main node on the current branch for the new repository
			toast.promise(
				createBranchNode.mutateAsync({ repositoryId: result.repository.id }),
				{
					loading: "Opening repository...",
					success: "Repository opened",
					error: (err) =>
						err instanceof Error ? err.message : "Failed to open repository",
				},
			);
		} catch (error) {
			toast.error("Failed to open repository", {
				description:
					error instanceof Error ? error.message : "An unknown error occurred",
			});
		}
	};

	const handleCloneError = (error: string) => {
		toast.error("Failed to clone repository", {
			description: error,
		});
	};

	const isLoading = openNew.isPending || createBranchNode.isPending;

	if (isCollapsed) {
		return (
			<>
				<div className="border-t border-border p-2 flex justify-center">
					<DropdownMenu>
						<Tooltip delayDuration={300}>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-8 text-muted-foreground hover:text-foreground"
										disabled={isLoading}
									>
										<LuFolderPlus
											className="size-4"
											strokeWidth={STROKE_WIDTH}
										/>
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent side="right">Add repository</TooltipContent>
						</Tooltip>
						<DropdownMenuContent side="top" align="start">
							<DropdownMenuItem
								onClick={handleOpenRepository}
								disabled={isLoading}
							>
								<LuFolderOpen className="size-4" strokeWidth={STROKE_WIDTH} />
								Open repository
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setIsCloneDialogOpen(true)}
								disabled={isLoading}
							>
								<LuFolderGit className="size-4" strokeWidth={STROKE_WIDTH} />
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

	return (
		<>
			<div className="border-t border-border/50 px-2.5 py-2.5">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-lg h-9 px-2.5 transition-all duration-200 group"
							disabled={isLoading}
						>
							<div className="flex items-center justify-center size-6 rounded-md bg-muted/30 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
								<LuFolderPlus className="w-3.5 h-3.5" strokeWidth={STROKE_WIDTH} />
							</div>
							<span className="text-sm">Add repository</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start" className="w-48">
						<DropdownMenuItem onClick={handleOpenRepository} disabled={isLoading} className="gap-2.5 py-2">
							<LuFolderOpen className="size-4" strokeWidth={STROKE_WIDTH} />
							Open repository
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => setIsCloneDialogOpen(true)}
							disabled={isLoading}
							className="gap-2.5 py-2"
						>
							<LuFolderGit className="size-4" strokeWidth={STROKE_WIDTH} />
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
