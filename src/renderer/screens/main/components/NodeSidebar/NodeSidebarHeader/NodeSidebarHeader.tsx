import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useMatchRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LuChevronRight, LuLayers, LuLayoutGrid, LuList, LuPanelRight, LuPanelRightClose, LuPanelRightOpen } from "react-icons/lu";
import { useState } from "react";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { useNodeSidebarStore } from "renderer/stores/node-sidebar-state";
import { useTabsStore } from "renderer/stores/tabs/store";
import { STROKE_WIDTH } from "../constants";
import { NewNodeButton } from "./NewNodeButton";

interface NodeSidebarHeaderProps {
	isCollapsed?: boolean;
}

export function NodeSidebarHeader({
	isCollapsed = false,
}: NodeSidebarHeaderProps) {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { toggleCollapsed } = useNodeSidebarStore();
	const { workspaceId } = useParams({ strict: false });
	const openKanbanDashboard = useTabsStore((s) => s.openKanbanDashboard);
	const getActiveTab = useTabsStore((s) => s.getActiveTab);
	const panes = useTabsStore((s) => s.panes);
	const focusedPaneIds = useTabsStore((s) => s.focusedPaneIds);
	const setActiveTab = useTabsStore((s) => s.setActiveTab);
	const tabs = useTabsStore((s) => s.tabs);

	// Derive active state from route
	const isNodesListOpen = !!matchRoute({ to: "/workspaces" });

	// State for Views folder expansion
	const [isViewsExpanded, setIsViewsExpanded] = useState(true);

	// Check if currently viewing kanban
	const activeTab = workspaceId ? getActiveTab(workspaceId) : null;
	const focusedPaneId = activeTab ? focusedPaneIds[activeTab.id] : null;
	const focusedPane = focusedPaneId ? panes[focusedPaneId] : null;
	const isKanbanView = focusedPane?.type === "kanban";

	// Switch to list view (find a non-kanban tab or the first terminal tab)
	const handleListViewClick = () => {
		if (!workspaceId) return;

		// Find a non-kanban tab for this workspace
		const workspaceTabs = tabs.filter((t) => t.nodeId === workspaceId);
		const nonKanbanTab = workspaceTabs.find((t) => {
			const tabPanes = Object.values(panes).filter((p) => p.tabId === t.id);
			return !tabPanes.some((p) => p.type === "kanban");
		});

		if (nonKanbanTab) {
			setActiveTab(nonKanbanTab.id);
		}
	};

	const handleNodesClick = () => {
		if (isNodesListOpen) {
			// Navigate back to node view
			navigate({ to: "/workspace" });
		} else {
			navigate({ to: "/workspaces" });
		}
	};

	const getToggleIcon = (isHovering: boolean) => {
		if (isCollapsed) {
			return isHovering ? (
				<LuPanelRightClose className="size-4" strokeWidth={1.5} />
			) : (
				<LuPanelRight className="size-4" strokeWidth={1.5} />
			);
		}
		return isHovering ? (
			<LuPanelRightOpen className="size-4" strokeWidth={1.5} />
		) : (
			<LuPanelRight className="size-4" strokeWidth={1.5} />
		);
	};

	if (isCollapsed) {
		return (
			<div className="flex flex-col items-center border-b border-border py-2 gap-2">
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={toggleCollapsed}
							className="group flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
						>
							<span className="group-hover:hidden">{getToggleIcon(false)}</span>
							<span className="hidden group-hover:block">{getToggleIcon(true)}</span>
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">
						<HotkeyTooltipContent
							label="Expand sidebar"
							hotkeyId="TOGGLE_NODE_SIDEBAR"
						/>
					</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleListViewClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								!isKanbanView
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuList className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">List View</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => {
								if (workspaceId) {
									openKanbanDashboard(workspaceId);
								}
							}}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isKanbanView
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuLayoutGrid className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">Kanban View</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleNodesClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isNodesListOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">Nodes</TooltipContent>
				</Tooltip>

				<NewNodeButton isCollapsed />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 border-b border-border/50 px-2.5 pt-3 pb-2.5">
			<div className="flex items-center justify-between mb-1">
				<span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-2.5">Navigation</span>
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={toggleCollapsed}
							className="group flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
						>
							<span className="group-hover:hidden">{getToggleIcon(false)}</span>
							<span className="hidden group-hover:block">{getToggleIcon(true)}</span>
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">
						<HotkeyTooltipContent
							label="Collapse sidebar"
							hotkeyId="TOGGLE_NODE_SIDEBAR"
						/>
					</TooltipContent>
				</Tooltip>
			</div>

			{/* Views - Collapsible folder */}
			<div className="flex flex-col">
				<button
					type="button"
					onClick={() => setIsViewsExpanded(!isViewsExpanded)}
					className="group flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all duration-200"
				>
					<LuChevronRight
						className={cn(
							"size-4 transition-transform duration-200",
							isViewsExpanded && "rotate-90"
						)}
						strokeWidth={STROKE_WIDTH}
					/>
					<div className="flex items-center justify-center size-6 rounded-md bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
						<LuLayoutGrid className="size-3.5" strokeWidth={STROKE_WIDTH} />
					</div>
					<span className="text-sm font-medium">Views</span>
				</button>
				{/* Sub-items - indented, shown when expanded */}
				{isViewsExpanded && (
					<div className="flex flex-col gap-0.5 pl-8 mt-0.5">
						<button
							type="button"
							onClick={handleListViewClick}
							className={cn(
								"group flex items-center gap-2 px-2.5 py-1.5 w-full rounded-md transition-all duration-200 text-xs",
								!isKanbanView
									? "text-foreground bg-accent/60"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/30",
							)}
						>
							<LuList className="size-3.5" strokeWidth={STROKE_WIDTH} />
							<span className="flex-1 text-left">List View</span>
						</button>
						<button
							type="button"
							onClick={() => {
								if (workspaceId) {
									openKanbanDashboard(workspaceId);
								}
							}}
							className={cn(
								"group flex items-center gap-2 px-2.5 py-1.5 w-full rounded-md transition-all duration-200 text-xs",
								isKanbanView
									? "text-foreground bg-accent/60"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/30",
							)}
						>
							<LuLayoutGrid className="size-3.5" strokeWidth={STROKE_WIDTH} />
							<span className="flex-1 text-left">Kanban View</span>
						</button>
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={handleNodesClick}
				className={cn(
					"group flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg transition-all duration-200",
					isNodesListOpen
						? "text-foreground bg-accent/80 shadow-sm"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/40",
				)}
			>
				<div className={cn(
					"flex items-center justify-center size-6 rounded-md transition-colors",
					isNodesListOpen
						? "bg-primary/15 text-primary"
						: "bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary",
				)}>
					<LuLayers className="size-3.5" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Nodes</span>
			</button>

			<NewNodeButton />
		</div>
	);
}
