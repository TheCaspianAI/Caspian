import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useParams } from "@tanstack/react-router";
import { LuPlus } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useOpenNodeSwitcherModal } from "renderer/stores/node-switcher-modal";
import {
	useDashboardModalOpen,
	useToggleDashboardModal,
} from "renderer/stores/dashboard-modal";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";

export function ContextHeader() {
	const { nodeId } = useParams({ strict: false });
	const openNewNodeModal = useOpenNewNodeModal();
	const openNodeSwitcher = useOpenNodeSwitcherModal();
	const isDashboardOpen = useDashboardModalOpen();
	const toggleDashboard = useToggleDashboardModal();
	const { data: node } = electronTrpc.nodes.get.useQuery(
		{ id: nodeId ?? "" },
		{ enabled: !!nodeId },
	);
	const { data: repository } = electronTrpc.repositories.get.useQuery(
		{ id: node?.repositoryId ?? "" },
		{ enabled: !!node?.repositoryId },
	);

	const repoName = repository?.name ?? "No repository";
	const nodeName = node?.name ?? "No node";

	const handleHeaderClick = () => {
		openNodeSwitcher();
	};

	const handleNewNode = (e: React.MouseEvent) => {
		e.stopPropagation();
		openNewNodeModal(node?.repositoryId);
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
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={handleHeaderClick}
						className="group flex flex-col gap-1 px-3 py-2.5 text-left w-full hover:bg-muted/40 transition-colors"
					>
						<span className="text-body font-medium text-foreground truncate">
							{repoName}
						</span>
						<div className="flex items-center gap-2">
							<span className="text-caption font-normal text-foreground/70 truncate flex-1">
								{nodeName}
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<span
										role="button"
										tabIndex={0}
										onClick={handleNewNode}
										onKeyDown={(e) => e.key === "Enter" && handleNewNode(e as unknown as React.MouseEvent)}
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
				<TooltipContent side="bottom" align="start">
					<HotkeyTooltipContent label="Switch node" hotkeyId="SWITCH_WORKSPACE" />
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
