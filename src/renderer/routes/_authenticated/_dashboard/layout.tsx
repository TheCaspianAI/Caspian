import { createFileRoute, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { NodeSidebar } from "renderer/screens/main/components/NodeSidebar";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { useToggleDashboardModal } from "renderer/stores/dashboard-modal";
import { useAppHotkey } from "renderer/stores/hotkeys";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useToggleNodeSwitcherModal } from "renderer/stores/node-switcher-modal";
import { useOpenSettings } from "renderer/stores/settings-state";
import {
	COLLAPSED_SIDEBAR_WIDTH,
	MAX_SIDEBAR_WIDTH,
	useSidebarStore,
} from "renderer/stores/sidebar-state";
import { cn } from "ui/lib/utils";
import { TopBar } from "./components/TopBar";

export const Route = createFileRoute("/_authenticated/_dashboard")({
	component: DashboardLayout,
});

function DashboardLayout() {
	const toggleDashboardModal = useToggleDashboardModal();
	const openNewNodeModal = useOpenNewNodeModal();
	const toggleNodeSwitcher = useToggleNodeSwitcherModal();
	const openSettings = useOpenSettings();

	const matchRoute = useMatchRoute();
	const currentNodeMatch = matchRoute({
		to: "/node/$nodeId",
		fuzzy: true,
	});
	const currentNodeId = currentNodeMatch !== false ? currentNodeMatch.nodeId : null;

	const { data: currentNode } = electronTrpc.nodes.get.useQuery(
		{ id: currentNodeId ?? "" },
		{ enabled: !!currentNodeId },
	);

	const navigate = useNavigate();
	const { data: nodeGroups } = electronTrpc.nodes.getAllGrouped.useQuery();
	const hasNodes = !!nodeGroups && nodeGroups.length > 0;

	const prevHasNodes = useRef(hasNodes);
	useEffect(() => {
		if (prevHasNodes.current && !hasNodes) {
			navigate({ to: "/node" });
		}
		prevHasNodes.current = hasNodes;
	}, [hasNodes, navigate]);

	const { isSidebarOpen, sidebarWidth, setSidebarWidth, isResizing, setIsResizing, toggleSidebar } =
		useSidebarStore();

	useAppHotkey("OPEN_SETTINGS", () => openSettings(), undefined, [openSettings]);

	useAppHotkey("SHOW_HOTKEYS", () => openSettings("preferences"), undefined, [openSettings]);

	useAppHotkey(
		"TOGGLE_NODE_SIDEBAR",
		() => {
			toggleSidebar();
		},
		undefined,
		[toggleSidebar],
	);

	useAppHotkey("NEW_NODE", () => openNewNodeModal(currentNode?.repositoryId), undefined, [
		openNewNodeModal,
		currentNode?.repositoryId,
	]);

	useAppHotkey("SWITCH_WORKSPACE", () => toggleNodeSwitcher(), undefined, [toggleNodeSwitcher]);

	useAppHotkey("OPEN_DASHBOARD", () => toggleDashboardModal(), undefined, [toggleDashboardModal]);

	return (
		<div className="flex flex-col h-full w-full bg-background">
			<TopBar />
			<div className="flex flex-1 overflow-hidden">
				{hasNodes && isSidebarOpen && (
					<ResizablePanel
						width={sidebarWidth}
						onWidthChange={setSidebarWidth}
						isResizing={isResizing}
						onResizingChange={setIsResizing}
						minWidth={COLLAPSED_SIDEBAR_WIDTH}
						maxWidth={MAX_SIDEBAR_WIDTH}
						handleSide="right"
						clampWidth={false}
					>
						<NodeSidebar />
					</ResizablePanel>
				)}
				<div
					className={cn(
						"flex-1 bg-background overflow-hidden",
						hasNodes && isSidebarOpen && "border-l border-border/40",
					)}
				>
					<Outlet />
				</div>
			</div>
		</div>
	);
}
