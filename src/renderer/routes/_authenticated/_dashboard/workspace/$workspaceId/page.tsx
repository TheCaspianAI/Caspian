import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronTrpcClient as trpcClient } from "renderer/lib/trpc-client";
import { usePresets } from "renderer/react-query/presets";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { usePresetHotkeys } from "renderer/routes/_authenticated/_dashboard/workspace/$workspaceId/hooks/usePresetHotkeys";
import { NotFound } from "renderer/routes/not-found";
import { NodeInitializingView } from "renderer/screens/main/components/NodeView/NodeInitializingView/NodeInitializingView";
import { NodeLayout } from "renderer/screens/main/components/NodeView/NodeLayout/NodeLayout";
import { useAppHotkey } from "renderer/stores/hotkeys";
import { SidebarMode, useSidebarStore } from "renderer/stores/sidebar-state";
import { getPaneDimensions } from "renderer/stores/tabs/pane-refs";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { Tab } from "renderer/stores/tabs/types";
import { useTabsWithPresets } from "renderer/stores/tabs/useTabsWithPresets";
import {
	findPanePath,
	getFirstPaneId,
	getNextPaneId,
	getPreviousPaneId,
	resolveActiveTabIdForNode,
} from "renderer/stores/tabs/utils";
import {
	useHasNodeFailed,
	useIsNodeInitializing,
} from "renderer/stores/node-init";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/workspace/$workspaceId/",
)({
	component: WorkspacePage,
	notFoundComponent: NotFound,
	loader: async ({ params, context }) => {
		const queryKey = [
			["nodes", "get"],
			{ input: { id: params.workspaceId }, type: "query" },
		];

		try {
			await context.queryClient.ensureQueryData({
				queryKey,
				queryFn: () =>
					trpcClient.nodes.get.query({ id: params.workspaceId }),
			});
		} catch (error) {
			// If node not found, throw notFound() to render 404 page
			if (error instanceof Error && error.message.includes("not found")) {
				throw notFound();
			}
			// Re-throw other errors
			throw error;
		}
	},
});

function WorkspacePage() {
	const { workspaceId } = Route.useParams();
	const { data: workspace } = electronTrpc.nodes.get.useQuery({
		id: workspaceId,
	});
	const navigate = useNavigate();

	// Check if node is initializing or failed
	const isInitializing = useIsNodeInitializing(workspaceId);
	const hasFailed = useHasNodeFailed(workspaceId);

	// Check for incomplete init after app restart
	const gitStatus = workspace?.worktree?.gitStatus;
	const hasIncompleteInit =
		workspace?.type === "worktree" &&
		(gitStatus === null || gitStatus === undefined);

	// Show full-screen initialization view for:
	// - Actively initializing nodes (shows progress)
	// - Failed nodes (shows error with retry)
	// - Interrupted nodes that aren't currently initializing (shows resume option)
	const showInitView = isInitializing || hasFailed || hasIncompleteInit;

	const allTabs = useTabsStore((s) => s.tabs);
	const activeTabIds = useTabsStore((s) => s.activeTabIds);
	const tabHistoryStacks = useTabsStore((s) => s.tabHistoryStacks);
	const focusedPaneIds = useTabsStore((s) => s.focusedPaneIds);
	const {
		addTab,
		splitPaneAuto,
		splitPaneVertical,
		splitPaneHorizontal,
		openPreset,
	} = useTabsWithPresets();
	const setActiveTab = useTabsStore((s) => s.setActiveTab);
	const removePane = useTabsStore((s) => s.removePane);
	const setFocusedPane = useTabsStore((s) => s.setFocusedPane);
	const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
	const isSidebarOpen = useSidebarStore((s) => s.isSidebarOpen);
	const setSidebarOpen = useSidebarStore((s) => s.setSidebarOpen);
	const currentSidebarMode = useSidebarStore((s) => s.currentMode);
	const setSidebarMode = useSidebarStore((s) => s.setMode);

	const tabs = useMemo(
		() => allTabs.filter((tab) => tab.nodeId === workspaceId),
		[workspaceId, allTabs],
	);

	const activeTabId = useMemo(() => {
		return resolveActiveTabIdForNode({
			nodeId: workspaceId,
			tabs,
			activeTabIds,
			tabHistoryStacks,
		});
	}, [workspaceId, tabs, activeTabIds, tabHistoryStacks]);

	const activeTab = useMemo(
		() => (activeTabId ? tabs.find((t) => t.id === activeTabId) : null),
		[activeTabId, tabs],
	);

	const focusedPaneId = activeTabId ? focusedPaneIds[activeTabId] : null;

	const { presets } = usePresets();

	const openTabWithPreset = useCallback(
		(presetIndex: number) => {
			const preset = presets[presetIndex];
			if (preset) {
				openPreset(workspaceId, preset);
			} else {
				addTab(workspaceId);
			}
		},
		[presets, workspaceId, addTab, openPreset],
	);

	useAppHotkey("NEW_GROUP", () => addTab(workspaceId), undefined, [
		workspaceId,
		addTab,
	]);
	usePresetHotkeys(openTabWithPreset);

	useAppHotkey(
		"CLOSE_TERMINAL",
		() => {
			if (focusedPaneId) {
				removePane(focusedPaneId);
			}
		},
		undefined,
		[focusedPaneId, removePane],
	);

	useAppHotkey(
		"PREV_TAB",
		() => {
			if (!activeTabId || tabs.length === 0) return;
			const index = tabs.findIndex((t) => t.id === activeTabId);
			const prevIndex = index <= 0 ? tabs.length - 1 : index - 1;
			setActiveTab(workspaceId, tabs[prevIndex].id);
		},
		undefined,
		[workspaceId, activeTabId, tabs, setActiveTab],
	);

	useAppHotkey(
		"NEXT_TAB",
		() => {
			if (!activeTabId || tabs.length === 0) return;
			const index = tabs.findIndex((t) => t.id === activeTabId);
			const nextIndex =
				index >= tabs.length - 1 || index === -1 ? 0 : index + 1;
			setActiveTab(workspaceId, tabs[nextIndex].id);
		},
		undefined,
		[workspaceId, activeTabId, tabs, setActiveTab],
	);

	useAppHotkey(
		"PREV_PANE",
		() => {
			if (!activeTabId || !activeTab?.layout || !focusedPaneId) return;
			const prevPaneId = getPreviousPaneId(activeTab.layout, focusedPaneId);
			if (prevPaneId) {
				setFocusedPane(activeTabId, prevPaneId);
			}
		},
		undefined,
		[activeTabId, activeTab?.layout, focusedPaneId, setFocusedPane],
	);

	useAppHotkey(
		"NEXT_PANE",
		() => {
			if (!activeTabId || !activeTab?.layout || !focusedPaneId) return;
			const nextPaneId = getNextPaneId(activeTab.layout, focusedPaneId);
			if (nextPaneId) {
				setFocusedPane(activeTabId, nextPaneId);
			}
		},
		undefined,
		[activeTabId, activeTab?.layout, focusedPaneId, setFocusedPane],
	);

	// Open in last used app shortcut
	const { data: lastUsedApp = "cursor" } =
		electronTrpc.settings.getLastUsedApp.useQuery();
	const openInApp = electronTrpc.external.openInApp.useMutation();
	useAppHotkey(
		"OPEN_IN_APP",
		() => {
			if (workspace?.worktreePath) {
				openInApp.mutate({
					path: workspace.worktreePath,
					app: lastUsedApp,
				});
			}
		},
		undefined,
		[workspace?.worktreePath, lastUsedApp],
	);

	// Copy path shortcut
	const copyPath = electronTrpc.external.copyPath.useMutation();
	useAppHotkey(
		"COPY_PATH",
		() => {
			if (workspace?.worktreePath) {
				copyPath.mutate(workspace.worktreePath);
			}
		},
		undefined,
		[workspace?.worktreePath],
	);

	// Toggle changes sidebar (⌘L)
	useAppHotkey("TOGGLE_SIDEBAR", () => toggleSidebar(), undefined, [
		toggleSidebar,
	]);

	// Toggle expand/collapse sidebar (⌘⇧L)
	useAppHotkey(
		"TOGGLE_EXPAND_SIDEBAR",
		() => {
			if (!isSidebarOpen) {
				setSidebarOpen(true);
				setSidebarMode(SidebarMode.Changes);
			} else {
				const isExpanded = currentSidebarMode === SidebarMode.Changes;
				setSidebarMode(isExpanded ? SidebarMode.Tabs : SidebarMode.Changes);
			}
		},
		undefined,
		[isSidebarOpen, setSidebarOpen, setSidebarMode, currentSidebarMode],
	);

	// Pane splitting helper - resolves target pane for split operations
	const resolveSplitTarget = useCallback(
		(paneId: string, tabId: string, targetTab: Tab) => {
			const path = findPanePath(targetTab.layout, paneId);
			if (path !== null) return { path, paneId };

			const firstPaneId = getFirstPaneId(targetTab.layout);
			const firstPanePath = findPanePath(targetTab.layout, firstPaneId);
			setFocusedPane(tabId, firstPaneId);
			return { path: firstPanePath ?? [], paneId: firstPaneId };
		},
		[setFocusedPane],
	);

	// Pane splitting shortcuts
	useAppHotkey(
		"SPLIT_AUTO",
		() => {
			if (activeTabId && focusedPaneId && activeTab) {
				const target = resolveSplitTarget(
					focusedPaneId,
					activeTabId,
					activeTab,
				);
				if (!target) return;
				const dimensions = getPaneDimensions(target.paneId);
				if (dimensions) {
					splitPaneAuto(activeTabId, target.paneId, dimensions, target.path);
				}
			}
		},
		undefined,
		[activeTabId, focusedPaneId, activeTab, splitPaneAuto, resolveSplitTarget],
	);

	useAppHotkey(
		"SPLIT_RIGHT",
		() => {
			if (activeTabId && focusedPaneId && activeTab) {
				const target = resolveSplitTarget(
					focusedPaneId,
					activeTabId,
					activeTab,
				);
				if (!target) return;
				splitPaneVertical(activeTabId, target.paneId, target.path);
			}
		},
		undefined,
		[
			activeTabId,
			focusedPaneId,
			activeTab,
			splitPaneVertical,
			resolveSplitTarget,
		],
	);

	useAppHotkey(
		"SPLIT_DOWN",
		() => {
			if (activeTabId && focusedPaneId && activeTab) {
				const target = resolveSplitTarget(
					focusedPaneId,
					activeTabId,
					activeTab,
				);
				if (!target) return;
				splitPaneHorizontal(activeTabId, target.paneId, target.path);
			}
		},
		undefined,
		[
			activeTabId,
			focusedPaneId,
			activeTab,
			splitPaneHorizontal,
			resolveSplitTarget,
		],
	);

	// Navigate to previous node (⌘↑)
	const getPreviousNode =
		electronTrpc.nodes.getPreviousNode.useQuery(
			{ id: workspaceId },
			{ enabled: !!workspaceId },
		);
	useAppHotkey(
		"PREV_NODE",
		() => {
			const prevNodeId = getPreviousNode.data;
			if (prevNodeId) {
				navigateToNode(prevNodeId, navigate);
			}
		},
		undefined,
		[getPreviousNode.data, navigate],
	);

	// Navigate to next node (⌘↓)
	const getNextNode = electronTrpc.nodes.getNextNode.useQuery(
		{ id: workspaceId },
		{ enabled: !!workspaceId },
	);
	useAppHotkey(
		"NEXT_NODE",
		() => {
			const nextNodeId = getNextNode.data;
			if (nextNodeId) {
				navigateToNode(nextNodeId, navigate);
			}
		},
		undefined,
		[getNextNode.data, navigate],
	);

	return (
		<div className="flex-1 h-full flex flex-col overflow-hidden">
			<div className="flex-1 min-h-0 flex overflow-hidden">
				{showInitView ? (
					<NodeInitializingView
						nodeId={workspaceId}
						nodeName={workspace?.name ?? "Node"}
						isInterrupted={hasIncompleteInit && !isInitializing}
					/>
				) : (
					<NodeLayout />
				)}
			</div>
		</div>
	);
}
