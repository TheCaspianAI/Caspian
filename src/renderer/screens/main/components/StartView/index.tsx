import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LuFolderOpen, LuGlobe, LuX } from "react-icons/lu";
import { useOpenFromPath, useOpenNew } from "renderer/react-query/repositories";
import { cn } from "ui/lib/utils";
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

				if ("repository" in result && result.repository) {
					navigate({
						to: "/project/$projectId",
						params: { projectId: result.repository.id },
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

						if ("repository" in result && result.repository) {
							navigate({
								to: "/project/$projectId",
								params: { projectId: result.repository.id },
							});
						}
					},
					onError: (err) => {
						setError(err.message || "Failed to open repository");
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
		<div className="flex flex-col h-full w-full relative overflow-hidden bg-black">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone for external files */}
			<div
				className="relative flex flex-1 items-center justify-center"
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				{/* Drop overlay */}
				{isDragOver && (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm">
						<div className="flex flex-col items-center gap-3 text-center">
							<div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/30 flex items-center justify-center">
								<LuFolderOpen className="w-8 h-8 text-white/60" />
							</div>
							<span className="text-sm text-white/60 font-medium">Drop to open project</span>
						</div>
					</div>
				)}

				<div
					className={cn(
						"flex flex-col items-center w-full max-w-2xl px-6 transition-opacity duration-200",
						isDragOver && "opacity-30 pointer-events-none",
					)}
				>
					{/* Logo */}
					<img
						src="./assets/caspian-logo.png"
						alt="Caspian"
						className="w-36 h-36 object-contain mb-8"
						draggable={false}
					/>

					{/* Title */}
					<h1 className="text-[44px] font-semibold text-white tracking-tight mb-3">Caspian</h1>

					{/* Subtext */}
					<p className="text-[18px] text-neutral-500 mb-12">Ship faster, one node at a time.</p>

					{/* Action buttons row */}
					<div className="flex items-center gap-3">
						{/* Open project button */}
						<button
							type="button"
							onClick={handleOpenProject}
							disabled={isLoading}
							className={cn(
								"inline-flex items-center gap-3 px-6 py-3",
								"rounded-xl border border-neutral-700/50 bg-transparent",
								"text-[15px] text-neutral-300",
								"transition-all duration-150",
								"hover:bg-white/5 hover:border-neutral-600",
								"focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
								"disabled:opacity-50 disabled:pointer-events-none",
							)}
						>
							<LuFolderOpen className="w-[18px] h-[18px] text-neutral-400" />
							<span>Open project</span>
						</button>

						{/* Clone from URL button */}
						<button
							type="button"
							onClick={() => setIsCloneDialogOpen(true)}
							disabled={isLoading}
							className={cn(
								"inline-flex items-center gap-3 px-6 py-3",
								"rounded-xl border border-neutral-700/50 bg-transparent",
								"text-[15px] text-neutral-300",
								"transition-all duration-150",
								"hover:bg-white/5 hover:border-neutral-600",
								"focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
								"disabled:opacity-50 disabled:pointer-events-none",
							)}
						>
							<LuGlobe className="w-[18px] h-[18px] text-neutral-400" />
							<span>Clone from URL</span>
						</button>
					</div>

					{/* Error message */}
					{error && (
						<div className="mt-8 w-full max-w-md rounded-lg bg-red-950/30 border border-red-900/50 px-4 py-3">
							<div className="flex items-start gap-3">
								<span className="flex-1 text-sm text-red-400">{error}</span>
								<button
									type="button"
									onClick={() => setError(null)}
									className="shrink-0 rounded p-0.5 text-red-400/70 hover:text-red-400 transition-colors"
									aria-label="Dismiss error"
								>
									<LuX className="h-4 w-4" />
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
