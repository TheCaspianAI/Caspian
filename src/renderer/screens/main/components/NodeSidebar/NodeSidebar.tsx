import { LuFolder, LuGitMerge, LuLayers, LuLayoutDashboard } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { useDashboardModalOpen, useToggleDashboardModal } from "renderer/stores/dashboard-modal";
import { SidebarTab, useSidebarStore } from "renderer/stores/sidebar-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { FilesView } from "../ContextRail/FilesView";
import { SystemNav } from "../ContextRail/SystemNav";
import { ChangesPanel } from "./components/ChangesPanel";
import { NodesPanel } from "./components/NodesPanel";
import { PortsList } from "./components/PortsList";

const TAB_LABEL_THRESHOLD = 240;

const TABS = [
	{ id: SidebarTab.Nodes, label: "Nodes", icon: LuLayers },
	{ id: SidebarTab.Changes, label: "Changes", icon: LuGitMerge },
	{ id: SidebarTab.Files, label: "Files", icon: LuFolder },
] as const;

export function NodeSidebar() {
	const isDashboardOpen = useDashboardModalOpen();
	const toggleDashboard = useToggleDashboardModal();
	const isCollapsed = useSidebarStore((s) => s.isSidebarCollapsed);
	const sidebarWidth = useSidebarStore((s) => s.sidebarWidth);
	const activeSidebarTab = useSidebarStore((s) => s.activeSidebarTab);
	const setActiveSidebarTab = useSidebarStore((s) => s.setActiveSidebarTab);

	const showTabLabels = !isCollapsed && sidebarWidth >= TAB_LABEL_THRESHOLD;

	return (
		<aside className="flex flex-col h-full overflow-hidden surface-sidebar">
			{/* Dashboard button — matches TopBar height so borders align */}
			<div className="shrink-0 h-10 flex items-center border-b border-border/20 surface-topbar">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={toggleDashboard}
							className={cn(
								"transition-colors duration-[80ms]",
								isCollapsed
									? "flex items-center justify-center size-8 mx-auto rounded-md"
									: "w-full h-full px-3 text-left text-section font-semibold flex items-center",
								isDashboardOpen
									? "bg-primary/10 text-foreground"
									: "text-nav-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							{isCollapsed ? <LuLayoutDashboard className="size-4" /> : "Agents Dashboard"}
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						<HotkeyTooltipContent label="Open Agents Dashboard" hotkeyId="OPEN_DASHBOARD" />
					</TooltipContent>
				</Tooltip>
			</div>

			{/* View tabs */}
			<div
				className={cn(
					"flex shrink-0 border-b border-border/40",
					isCollapsed ? "flex-col gap-1 py-2 items-center" : "gap-1 px-3 py-2",
				)}
			>
				{TABS.map((tab) => {
					const isActive = activeSidebarTab === tab.id;
					const Icon = tab.icon;

					const button = (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveSidebarTab(tab.id)}
							className={cn(
								"flex items-center justify-center gap-1.5 rounded-md transition-colors duration-[80ms]",
								isCollapsed ? "size-8" : "h-7 flex-1 min-w-0",
								!isCollapsed && showTabLabels && "px-2",
								isActive
									? "bg-primary/10 text-foreground"
									: "text-nav-foreground hover:bg-accent/60 hover:text-foreground",
							)}
						>
							<Icon className="size-3.5 shrink-0" />
							{showTabLabels && <span className="text-body font-medium truncate">{tab.label}</span>}
						</button>
					);

					if (!showTabLabels) {
						return (
							<Tooltip key={tab.id}>
								<TooltipTrigger asChild>{button}</TooltipTrigger>
								<TooltipContent side={isCollapsed ? "right" : "bottom"}>{tab.label}</TooltipContent>
							</Tooltip>
						);
					}

					return button;
				})}
			</div>

			{/* Tab content */}
			{activeSidebarTab === SidebarTab.Nodes && <NodesPanel isCollapsed={isCollapsed} />}
			{activeSidebarTab === SidebarTab.Changes && <ChangesPanel />}
			{activeSidebarTab === SidebarTab.Files && <FilesView />}

			{!isCollapsed && <PortsList />}
			<SystemNav isCollapsed={isCollapsed} />
		</aside>
	);
}
