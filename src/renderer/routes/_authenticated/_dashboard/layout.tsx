import {
	createFileRoute,
	Outlet,
	useMatchRoute,
	useNavigate,
} from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { NodeSidebar } from "renderer/screens/main/components/NodeSidebar";
import { useAppHotkey } from "renderer/stores/hotkeys";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import {
	COLLAPSED_NODE_SIDEBAR_WIDTH,
	MAX_NODE_SIDEBAR_WIDTH,
	useNodeSidebarStore,
} from "renderer/stores/node-sidebar-state";
import { TopBar } from "./components/TopBar";

export const Route = createFileRoute("/_authenticated/_dashboard")({
	component: DashboardLayout,
});

function DashboardLayout() {
	const navigate = useNavigate();
	const openNewNodeModal = useOpenNewNodeModal();

	// Get current node from route to pre-select repository in new node modal
	const matchRoute = useMatchRoute();
	const currentNodeMatch = matchRoute({
		to: "/workspace/$workspaceId",
		fuzzy: true,
	});
	const currentNodeId =
		currentNodeMatch !== false ? currentNodeMatch.workspaceId : null;

	const { data: currentNode } = electronTrpc.nodes.get.useQuery(
		{ id: currentNodeId ?? "" },
		{ enabled: !!currentNodeId },
	);

	const {
		isOpen: isNodeSidebarOpen,
		toggleCollapsed: toggleNodeSidebarCollapsed,
		setOpen: setNodeSidebarOpen,
		width: nodeSidebarWidth,
		setWidth: setNodeSidebarWidth,
		isResizing: isNodeSidebarResizing,
		setIsResizing: setNodeSidebarIsResizing,
		isCollapsed: isNodeSidebarCollapsed,
	} = useNodeSidebarStore();

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
			if (!isNodeSidebarOpen) {
				setNodeSidebarOpen(true);
			} else {
				toggleNodeSidebarCollapsed();
			}
		},
		undefined,
		[isNodeSidebarOpen, setNodeSidebarOpen, toggleNodeSidebarCollapsed],
	);

	useAppHotkey(
		"NEW_NODE",
		() => openNewNodeModal(currentNode?.repositoryId),
		undefined,
		[openNewNodeModal, currentNode?.repositoryId],
	);

	return (
		<div className="flex flex-col h-full w-full ambient-bg">
			<TopBar />
			<div className="flex flex-1 overflow-hidden px-3 pb-3 gap-2">
				<div className="flex-1 rounded-xl overflow-hidden glass">
					<Outlet />
				</div>
				{isNodeSidebarOpen && (
					<ResizablePanel
						width={nodeSidebarWidth}
						onWidthChange={setNodeSidebarWidth}
						isResizing={isNodeSidebarResizing}
						onResizingChange={setNodeSidebarIsResizing}
						minWidth={COLLAPSED_NODE_SIDEBAR_WIDTH}
						maxWidth={MAX_NODE_SIDEBAR_WIDTH}
						handleSide="left"
						clampWidth={false}
					>
						<NodeSidebar isCollapsed={isNodeSidebarCollapsed()} />
					</ResizablePanel>
				)}
			</div>
		</div>
	);
}
