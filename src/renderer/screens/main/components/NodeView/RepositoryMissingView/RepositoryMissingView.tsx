import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HiExclamationTriangle } from "react-icons/hi2";
import { LuLoader } from "react-icons/lu";
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

interface RepositoryMissingViewProps {
	repositoryId: string;
	repositoryName: string;
}

export function RepositoryMissingView({
	repositoryId,
	repositoryName,
}: RepositoryMissingViewProps) {
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();

	const relocateMutation = electronTrpc.repositories.relocate.useMutation({
		onSuccess: (data) => {
			if (data.success) {
				utils.nodes.invalidate();
				utils.repositories.invalidate();
			}
		},
	});

	const removeMutation = electronTrpc.repositories.remove.useMutation({
		onSuccess: async () => {
			await utils.nodes.invalidate();
			await utils.repositories.invalidate();
			navigate({ to: "/" });
		},
	});

	const handleLocate = () => {
		relocateMutation.mutate({ id: repositoryId });
	};

	const handleRemove = () => {
		setShowRemoveConfirm(false);
		removeMutation.mutate({ id: repositoryId });
	};

	return (
		<>
			<div className="flex flex-col items-center justify-center h-full w-full px-8">
				<div className="flex flex-col items-center max-w-sm text-center space-y-6">
					<div className="flex items-center justify-center size-16 rounded-full bg-amber-500/10">
						<HiExclamationTriangle className="size-8 text-amber-500" />
					</div>

					<div className="space-y-2">
						<h2 className="text-lg font-medium text-foreground">Repository not found</h2>
						<p className="text-sm text-muted-foreground">{repositoryName}</p>
						<p className="text-xs text-muted-foreground/80 mt-2">
							The project folder for this repository has been moved or deleted. You can point
							Caspian to the new location, or remove the repository.
						</p>
					</div>

					<div className="flex gap-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowRemoveConfirm(true)}
							disabled={removeMutation.isPending}
						>
							{removeMutation.isPending ? "Removing..." : "Remove Repository"}
						</Button>
						<Button size="sm" onClick={handleLocate} disabled={relocateMutation.isPending}>
							{relocateMutation.isPending ? (
								<>
									<LuLoader className="mr-2 size-4 animate-spin" />
									Locating...
								</>
							) : (
								"Locate Folder"
							)}
						</Button>
					</div>

					{relocateMutation.data &&
						!relocateMutation.data.success &&
						!relocateMutation.data.canceled &&
						"error" in relocateMutation.data && (
							<p className="text-xs text-destructive/80 bg-destructive/5 rounded-md px-3 py-2">
								{relocateMutation.data.error}
							</p>
						)}
				</div>
			</div>

			<AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
				<AlertDialogContent className="max-w-[340px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">Remove "{repositoryName}"?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground">
								This will remove the repository and all its nodes from Caspian. No files on disk
								will be deleted.
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={() => setShowRemoveConfirm(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={handleRemove}
						>
							Remove
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
