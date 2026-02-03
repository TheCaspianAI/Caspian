import {
	createFileRoute,
	Outlet,
	useMatchRoute,
	useNavigate,
} from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { ContextRail } from "renderer/screens/main/components/ContextRail";
import { useAppHotkey } from "renderer/stores/hotkeys";
import { useToggleDashboardModal } from "renderer/stores/dashboard-modal";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useOpenNodeSwitcherModal } from "renderer/stores/node-switcher-modal";
import {
	MIN_SIDEBAR_WIDTH,
	MAX_SIDEBAR_WIDTH,
	useSidebarStore,
} from "renderer/stores/sidebar-state";
import { TopBar } from "./components/TopBar";

export const Route = createFileRoute("/_authenticated/_dashboard")({
	component: DashboardLayout,
});

function DashboardLayout() {
	const navigate = useNavigate();
	const toggleDashboardModal = useToggleDashboardModal();
	const openNewNodeModal = useOpenNewNodeModal();
	const openNodeSwitcher = useOpenNodeSwitcherModal();

	// Get current node from route to pre-select repository in new node modal
	const matchRoute = useMatchRoute();
	const currentNodeMatch = matchRoute({
		to: "/node/$nodeId",
		fuzzy: true,
	});
	const currentNodeId =
		currentNodeMatch !== false ? currentNodeMatch.nodeId : null;

	const { data: currentNode } = electronTrpc.nodes.get.useQuery(
		{ id: currentNodeId ?? "" },
		{ enabled: !!currentNodeId },
	);

	const {
		isSidebarOpen,
		sidebarWidth,
		setSidebarWidth,
		isResizing,
		setIsResizing,
		toggleSidebar,
	} = useSidebarStore();

	// Global hotkeys for dashboard
	useAppHotkey(
		"OPEN_SETTINGS",
		() => navigate({ to: "/settings/appearance" }),
		undefined,
		[navigate],
	);

	useAppHotkey(
		"SHOW_HOTKEYS",
		() => navigate({ to: "/settings/keyboard" }),
		undefined,
		[navigate],
	);

	useAppHotkey(
		"TOGGLE_NODE_SIDEBAR",
		() => {
			toggleSidebar();
		},
		undefined,
		[toggleSidebar],
	);

	useAppHotkey(
		"NEW_NODE",
		() => openNewNodeModal(currentNode?.repositoryId),
		undefined,
		[openNewNodeModal, currentNode?.repositoryId],
	);

	useAppHotkey(
		"SWITCH_WORKSPACE",
		() => openNodeSwitcher(),
		undefined,
		[openNodeSwitcher],
	);

	useAppHotkey(
		"OPEN_DASHBOARD",
		() => toggleDashboardModal(),
		undefined,
		[toggleDashboardModal],
	);

	// Only show ContextRail on node routes (requires node context for Files/Changes)
	const isNodeRoute = !!currentNodeId;
	const showContextRail = isSidebarOpen && isNodeRoute;

	return (
		<div className="flex flex-col h-full w-full bg-tertiary">
			<TopBar />
			<div className="flex flex-1 overflow-hidden">
				{showContextRail && (
					<ResizablePanel
						width={sidebarWidth}
						onWidthChange={setSidebarWidth}
						isResizing={isResizing}
						onResizingChange={setIsResizing}
						minWidth={MIN_SIDEBAR_WIDTH}
						maxWidth={MAX_SIDEBAR_WIDTH}
						handleSide="right"
					>
						<ContextRail />
					</ResizablePanel>
				)}
				<div className="flex-1 m-3 bg-background rounded-[var(--radius-modal)] overflow-hidden elevation-2">
					<Outlet />
				</div>
			</div>
		</div>
	);
}
