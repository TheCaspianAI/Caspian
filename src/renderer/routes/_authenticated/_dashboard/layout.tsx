import {
	createFileRoute,
	Outlet,
	useMatchRoute,
	useNavigate,
} from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { WorkspaceSidebar } from "renderer/screens/main/components/WorkspaceSidebar";
import { useAppHotkey } from "renderer/stores/hotkeys";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import {
	COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
	MAX_WORKSPACE_SIDEBAR_WIDTH,
	useWorkspaceSidebarStore,
} from "renderer/stores/workspace-sidebar-state";
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

	const { data: currentNode } = electronTrpc.workspaces.get.useQuery(
		{ id: currentNodeId ?? "" },
		{ enabled: !!currentNodeId },
	);

	const {
		isOpen: isWorkspaceSidebarOpen,
		toggleCollapsed: toggleWorkspaceSidebarCollapsed,
		setOpen: setWorkspaceSidebarOpen,
		width: workspaceSidebarWidth,
		setWidth: setWorkspaceSidebarWidth,
		isResizing: isWorkspaceSidebarResizing,
		setIsResizing: setWorkspaceSidebarIsResizing,
		isCollapsed: isWorkspaceSidebarCollapsed,
	} = useWorkspaceSidebarStore();

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
		"TOGGLE_WORKSPACE_SIDEBAR",
		() => {
			if (!isWorkspaceSidebarOpen) {
				setWorkspaceSidebarOpen(true);
			} else {
				toggleWorkspaceSidebarCollapsed();
			}
		},
		undefined,
		[
			isWorkspaceSidebarOpen,
			setWorkspaceSidebarOpen,
			toggleWorkspaceSidebarCollapsed,
		],
	);

	useAppHotkey(
		"NEW_WORKSPACE",
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
				{isWorkspaceSidebarOpen && (
					<ResizablePanel
						width={workspaceSidebarWidth}
						onWidthChange={setWorkspaceSidebarWidth}
						isResizing={isWorkspaceSidebarResizing}
						onResizingChange={setWorkspaceSidebarIsResizing}
						minWidth={COLLAPSED_WORKSPACE_SIDEBAR_WIDTH}
						maxWidth={MAX_WORKSPACE_SIDEBAR_WIDTH}
						handleSide="left"
						clampWidth={false}
					>
						<WorkspaceSidebar isCollapsed={isWorkspaceSidebarCollapsed()} />
					</ResizablePanel>
				)}
			</div>
		</div>
	);
}
