import { cn } from "ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LuFolderGit, LuFolderOpen, LuX } from "react-icons/lu";
import { useOpenFromPath, useOpenNew } from "renderer/react-query/projects";
import { CloneRepoDialog } from "./CloneRepoDialog";
import { InitGitDialog } from "./InitGitDialog";

export function StartView() {
	const navigate = useNavigate();
	const openNew = useOpenNew();
	const openFromPath = useOpenFromPath();
	const [error, setError] = useState<string | null>(null);
	const [initGitDialog, setInitGitDialog] = useState<{
		isOpen: boolean;
		selectedPath: string;
	}>({ isOpen: false, selectedPath: "" });
	const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);

	const isLoading = openNew.isPending || openFromPath.isPending;

	useEffect(() => {
		if (!error) return;
		const timer = setTimeout(() => setError(null), 5000);
		return () => clearTimeout(timer);
	}, [error]);

	useEffect(() => {
		const handleWindowDragEnd = () => setIsDragOver(false);
		const handleWindowDrop = () => setIsDragOver(false);

		window.addEventListener("dragend", handleWindowDragEnd);
		window.addEventListener("drop", handleWindowDrop);

		return () => {
			window.removeEventListener("dragend", handleWindowDragEnd);
			window.removeEventListener("drop", handleWindowDrop);
		};
	}, []);

	const handleOpenProject = () => {
		if (isDragOver) return;
		setError(null);
		openNew.mutate(undefined, {
			onSuccess: (result) => {
				if (result.canceled) {
					return;
				}

				if ("error" in result) {
					setError(result.error);
					return;
				}

				if ("needsGitInit" in result) {
					setInitGitDialog({
						isOpen: true,
						selectedPath: result.selectedPath,
					});
					return;
				}

				if ("project" in result && result.project) {
					navigate({
						to: "/project/$projectId",
						params: { projectId: result.project.id },
					});
				}
			},
			onError: (err) => {
				setError(err.message || "Failed to open project");
			},
		});
	};

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (e.dataTransfer.types.includes("Files")) {
			setIsDragOver(true);
			e.dataTransfer.dropEffect = "copy";
		}
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const rect = e.currentTarget.getBoundingClientRect();
		const { clientX, clientY } = e;

		if (
			clientX < rect.left ||
			clientX > rect.right ||
			clientY < rect.top ||
			clientY > rect.bottom
		) {
			setIsDragOver(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);

			if (isLoading) return;

			setError(null);

			const files = Array.from(e.dataTransfer.files);
			const firstFile = files[0];
			if (!firstFile) return;

			let filePath: string;
			try {
				filePath = window.webUtils.getPathForFile(firstFile);
			} catch {
				setError("Could not get path from dropped item");
				return;
			}

			if (!filePath) {
				setError("Could not get path from dropped item");
				return;
			}

			openFromPath.mutate(
				{ path: filePath },
				{
					onSuccess: (result) => {
						if ("canceled" in result && result.canceled) {
							return;
						}

						if ("error" in result) {
							setError(result.error);
							return;
						}

						if ("needsGitInit" in result) {
							setInitGitDialog({
								isOpen: true,
								selectedPath: result.selectedPath,
							});
							return;
						}

						if ("project" in result && result.project) {
							navigate({
								to: "/project/$projectId",
								params: { projectId: result.project.id },
							});
						}
					},
					onError: (err) => {
						setError(err.message || "Failed to open project");
					},
				},
			);
		},
		[openFromPath, isLoading, navigate],
	);

	const handleCloneError = (errorMessage: string) => {
		setError(errorMessage);
	};

	return (
		<div className="flex flex-col h-full w-full relative overflow-hidden">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone for external files */}
			<div
				className="relative flex flex-1 items-center justify-center"
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<div className="flex flex-col items-center w-full max-w-xs px-4">
					<h1
						className={cn(
							"text-2xl font-semibold text-foreground mb-8 transition-opacity duration-200",
							isDragOver && "opacity-0",
						)}
					>
						Caspian
					</h1>

					<div className="w-full flex flex-col gap-3">
						{/* Main drop zone / open project button */}
						<button
							type="button"
							onClick={handleOpenProject}
							disabled={isLoading}
							className={cn(
								"w-full rounded-xl transition-all duration-200",
								"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								"disabled:opacity-50 disabled:pointer-events-none",
								isDragOver
									? "glass py-16 primary-glow border-primary/40"
									: "glass px-5 py-8 hover:primary-glow-subtle hover:-translate-y-0.5",
							)}
						>
							{isDragOver ? (
								<div className="flex flex-col items-center gap-2">
									<LuFolderGit className="w-6 h-6 text-primary" />
									<span className="text-sm text-primary font-medium">
										Drop git project
									</span>
								</div>
							) : (
								<div className="flex-1 text-left">
									<LuFolderOpen className="w-5 h-5 text-primary mb-2" />
									<div className="text-sm font-medium text-foreground">
										Open Project
									</div>
									<div className="text-xs mt-1 text-muted-foreground">
										Drag git folder or click to browse
									</div>
								</div>
							)}
						</button>

						{/* Clone repo button */}
						<button
							type="button"
							onClick={() => setIsCloneDialogOpen(true)}
							disabled={isLoading || isDragOver}
							className={cn(
								"w-full rounded-xl glass px-4 py-3",
								"transition-all duration-200",
								"hover:bg-accent hover:-translate-y-0.5",
								"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								"disabled:opacity-50 disabled:pointer-events-none",
								isDragOver && "opacity-0",
							)}
						>
							<div className="flex items-center gap-3">
								<LuFolderGit className="w-4 h-4 text-muted-foreground" />
								<span className="text-sm text-muted-foreground">
									Clone Repository
								</span>
							</div>
						</button>
					</div>

					<p
						className={cn(
							"mt-4 text-xs text-muted-foreground/50 text-center transition-opacity",
							isDragOver && "opacity-0",
						)}
					>
						Any folder with a .git directory
					</p>

					{error && !isDragOver && (
						<div className="mt-4 w-full glass rounded-lg px-3 py-2 border-l-2 border-l-destructive">
							<div className="flex items-start gap-2">
								<span className="flex-1 text-xs text-destructive">{error}</span>
								<button
									type="button"
									onClick={() => setError(null)}
									className="shrink-0 rounded p-0.5 text-destructive/70 hover:text-destructive transition-colors"
									aria-label="Dismiss error"
								>
									<LuX className="h-3 w-3" />
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			<InitGitDialog
				isOpen={initGitDialog.isOpen}
				selectedPath={initGitDialog.selectedPath}
				onClose={() => setInitGitDialog({ isOpen: false, selectedPath: "" })}
				onError={setError}
			/>

			<CloneRepoDialog
				isOpen={isCloneDialogOpen}
				onClose={() => setIsCloneDialogOpen(false)}
				onError={handleCloneError}
			/>
		</div>
	);
}
