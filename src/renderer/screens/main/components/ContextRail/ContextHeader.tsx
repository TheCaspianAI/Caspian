import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { LuPlus } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useNodeDeleteHandler } from "renderer/react-query/nodes/useNodeDeleteHandler";
import { useDashboardModalOpen, useToggleDashboardModal } from "renderer/stores/dashboard-modal";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useOpenNodeSwitcherModal } from "renderer/stores/node-switcher-modal";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useNodeRename } from "../../hooks/useNodeRename/useNodeRename";
import { useRepositoryRename } from "../../hooks/useRepositoryRename/useRepositoryRename";
import { DeleteNodeDialog } from "../NodesListView/components/DeleteNodeDialog/DeleteNodeDialog";

export function ContextHeader() {
	const { nodeId } = useParams({ strict: false });
	const navigate = useNavigate();
	const openNewNodeModal = useOpenNewNodeModal();
	const openNodeSwitcher = useOpenNodeSwitcherModal();
	const isDashboardOpen = useDashboardModalOpen();
	const toggleDashboard = useToggleDashboardModal();
	const { showDeleteDialog, setShowDeleteDialog, handleDeleteClick } = useNodeDeleteHandler();

	const { data: node } = electronTrpc.nodes.get.useQuery(
		{ id: nodeId ?? "" },
		{ enabled: !!nodeId },
	);
	const { data: repository } = electronTrpc.repositories.get.useQuery(
		{ id: node?.repositoryId ?? "" },
		{ enabled: !!node?.repositoryId },
	);

	// Rename hooks
	const nodeRename = useNodeRename(nodeId ?? "", node?.name ?? "");
	const repoRename = useRepositoryRename(node?.repositoryId ?? "", repository?.name ?? "");

	// Refs for rename inputs
	const nodeInputRef = useRef<HTMLInputElement>(null);
	const repoInputRef = useRef<HTMLInputElement>(null);

	// Focus and select input when rename mode starts
	useEffect(() => {
		if (nodeRename.isRenaming && nodeInputRef.current) {
			nodeInputRef.current.focus();
			nodeInputRef.current.select();
		}
	}, [nodeRename.isRenaming]);

	useEffect(() => {
		if (repoRename.isRenaming && repoInputRef.current) {
			repoInputRef.current.focus();
			repoInputRef.current.select();
		}
	}, [repoRename.isRenaming]);

	// External actions
	const openInApp = electronTrpc.external.openInApp.useMutation();

	// Close repo mutation
	const utils = electronTrpc.useUtils();
	const closeRepo = electronTrpc.repositories.close.useMutation({
		onSuccess: async () => {
			await utils.repositories.invalidate();
			await utils.nodes.invalidate();
			// Navigate to start view after closing
			navigate({ to: "/" });
		},
	});

	const repoName = repository?.name ?? "No repository";
	const nodeName = node?.name ?? "No node";
	const isBranch = node?.type === "branch";
	const deleteActionLabel = isBranch ? "Close node" : "Delete node";

	const handleHeaderClick = () => {
		if (nodeRename.isRenaming || repoRename.isRenaming) return;
		openNodeSwitcher();
	};

	const handleNewNode = (e: React.MouseEvent) => {
		e.stopPropagation();
		openNewNodeModal(node?.repositoryId);
	};

	const handleOpenInFinder = () => {
		if (node?.worktreePath) {
			openInApp.mutate({ path: node.worktreePath, app: "finder" });
		}
	};

	const handleCloseRepo = () => {
		if (node?.repositoryId) {
			closeRepo.mutate({ id: node.repositoryId });
		}
	};

	return (
		<div className="flex flex-col">
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={toggleDashboard}
						className={`w-full h-12 px-3 text-left text-body font-medium transition-colors ${
							isDashboardOpen
								? "bg-accent text-foreground"
								: "text-muted-foreground hover:bg-accent hover:text-foreground"
						}`}
					>
						Agents Dashboard
					</button>
				</TooltipTrigger>
				<TooltipContent side="right">
					<HotkeyTooltipContent label="Open Agents Dashboard" hotkeyId="OPEN_DASHBOARD" />
				</TooltipContent>
			</Tooltip>

			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={handleHeaderClick}
									className="group flex flex-col gap-1 px-3 py-2.5 text-left w-full hover:bg-muted/40 transition-colors"
								>
									{/* Repository name - with inline rename */}
									{repoRename.isRenaming ? (
										<input
											ref={repoInputRef}
											type="text"
											value={repoRename.renameValue}
											onChange={(e) => repoRename.setRenameValue(e.target.value)}
											onKeyDown={repoRename.handleKeyDown}
											onBlur={repoRename.submitRename}
											onClick={(e) => e.stopPropagation()}
											className="text-body font-medium text-foreground bg-transparent border-b border-foreground/30 outline-none w-full"
										/>
									) : (
										<span className="text-body font-medium text-foreground truncate">
											{repoName}
										</span>
									)}

									<div className="flex items-center gap-2">
										{/* Node name - with inline rename */}
										{nodeRename.isRenaming ? (
											<input
												ref={nodeInputRef}
												type="text"
												value={nodeRename.renameValue}
												onChange={(e) => nodeRename.setRenameValue(e.target.value)}
												onKeyDown={nodeRename.handleKeyDown}
												onBlur={nodeRename.submitRename}
												onClick={(e) => e.stopPropagation()}
												className="text-caption font-normal text-foreground/70 bg-transparent border-b border-foreground/30 outline-none flex-1"
											/>
										) : (
											<span className="text-caption font-normal text-foreground/70 truncate flex-1">
												{nodeName}
											</span>
										)}
										<Tooltip>
											<TooltipTrigger asChild>
												<span
													role="button"
													tabIndex={0}
													onClick={handleNewNode}
													onKeyDown={(e) =>
														e.key === "Enter" && handleNewNode(e as unknown as React.MouseEvent)
													}
													className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground focus:opacity-100 focus:outline-none"
												>
													<LuPlus className="size-3.5" />
												</span>
											</TooltipTrigger>
											<TooltipContent side="right">
												<HotkeyTooltipContent label="New node" hotkeyId="NEW_NODE" />
											</TooltipContent>
										</Tooltip>
									</div>
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">
								<HotkeyTooltipContent label="Switch node" hotkeyId="SWITCH_WORKSPACE" />
							</TooltipContent>
						</Tooltip>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					{/* Node actions */}
					<ContextMenuItem onSelect={() => nodeRename.startRename()} disabled={!nodeId}>
						Rename node
					</ContextMenuItem>
					<ContextMenuItem onSelect={handleOpenInFinder} disabled={!node?.worktreePath}>
						Open in Finder
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => handleDeleteClick()}
						className="text-destructive focus:text-destructive"
						disabled={!nodeId}
					>
						{deleteActionLabel}
					</ContextMenuItem>

					<ContextMenuSeparator />

					{/* Repository actions */}
					<ContextMenuItem onSelect={() => repoRename.startRename()} disabled={!node?.repositoryId}>
						Rename repository
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={handleCloseRepo}
						className="text-destructive focus:text-destructive"
						disabled={!node?.repositoryId}
					>
						Close repository
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			{nodeId && node && (
				<DeleteNodeDialog
					nodeId={nodeId}
					nodeName={node.name}
					nodeType={node.type}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
				/>
			)}
		</div>
	);
}
