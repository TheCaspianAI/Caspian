import type { MosaicNode } from "react-mosaic-component";
import { updateTree } from "react-mosaic-component";
import { trpcTabsStorage } from "renderer/lib/trpc-storage";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { movePaneToNewTab, movePaneToTab } from "./actions/move-pane";
import type {
	AddFileViewerPaneOptions,
	AddTabWithMultiplePanesOptions,
	TabsState,
	TabsStore,
} from "./types";
import {
	buildMultiPaneLayout,
	type CreatePaneOptions,
	createFileViewerPane,
	createKanbanPane,
	createPane,
	createTabWithPane,
	extractPaneIdsFromLayout,
	generateId,
	generateTabName,
	getAdjacentPaneId,
	getFirstPaneId,
	getPaneIdsForTab,
	isLastPaneInTab,
	removePaneFromLayout,
	resolveActiveTabIdForNode,
	resolveFileViewerMode,
} from "./utils";
import { killTerminalForPane } from "./utils/terminal-cleanup";

/**
 * Finds the next best tab to activate when closing a tab.
 * Priority order:
 * 1. Most recently used tab from history stack
 * 2. Next/previous tab by position
 * 3. Any remaining tab in the node
 */
const findNextTab = (state: TabsState, tabIdToClose: string): string | null => {
	const tabToClose = state.tabs.find((t) => t.id === tabIdToClose);
	if (!tabToClose) return null;

	const nodeId = tabToClose.nodeId;
	const nodeTabs = state.tabs.filter(
		(t) => t.nodeId === nodeId && t.id !== tabIdToClose,
	);

	if (nodeTabs.length === 0) return null;

	// Try history first
	const historyStack = state.tabHistoryStacks[nodeId] || [];
	for (const historyTabId of historyStack) {
		if (historyTabId === tabIdToClose) continue;
		if (nodeTabs.some((t) => t.id === historyTabId)) {
			return historyTabId;
		}
	}

	// Try position-based (next, then previous)
	const allNodeTabs = state.tabs.filter(
		(t) => t.nodeId === nodeId,
	);
	const currentIndex = allNodeTabs.findIndex((t) => t.id === tabIdToClose);

	if (currentIndex !== -1) {
		const nextIndex = currentIndex + 1;
		const prevIndex = currentIndex - 1;

		if (
			nextIndex < allNodeTabs.length &&
			allNodeTabs[nextIndex].id !== tabIdToClose
		) {
			return allNodeTabs[nextIndex].id;
		}
		if (prevIndex >= 0 && allNodeTabs[prevIndex].id !== tabIdToClose) {
			return allNodeTabs[prevIndex].id;
		}
	}

	// Fallback to first available
	return nodeTabs[0]?.id || null;
};

export const useTabsStore = create<TabsStore>()(
	devtools(
		persist(
			(set, get) => ({
				tabs: [],
				panes: {},
				activeTabIds: {},
				focusedPaneIds: {},
				tabHistoryStacks: {},

				// Tab operations
				addTab: (nodeId, options?: CreatePaneOptions) => {
					const state = get();

					const { tab, pane } = createTabWithPane(
						nodeId,
						state.tabs,
						options,
					);

					const currentActiveId = state.activeTabIds[nodeId];
					const historyStack = state.tabHistoryStacks[nodeId] || [];
					const newHistoryStack = currentActiveId
						? [
								currentActiveId,
								...historyStack.filter((id) => id !== currentActiveId),
							]
						: historyStack;

					set({
						tabs: [...state.tabs, tab],
						panes: { ...state.panes, [pane.id]: pane },
						activeTabIds: {
							...state.activeTabIds,
							[nodeId]: tab.id,
						},
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tab.id]: pane.id,
						},
						tabHistoryStacks: {
							...state.tabHistoryStacks,
							[nodeId]: newHistoryStack,
						},
					});

					return { tabId: tab.id, paneId: pane.id };
				},

				addTabWithMultiplePanes: (
					nodeId: string,
					options: AddTabWithMultiplePanesOptions,
				) => {
					const state = get();
					const tabId = generateId("tab");
					const panes: ReturnType<typeof createPane>[] = options.commands.map(
						(command) =>
							createPane(tabId, "terminal", {
								initialCommands: [command],
								initialCwd: options.initialCwd,
							}),
					);

					const paneIds = panes.map((p) => p.id);
					const layout = buildMultiPaneLayout(paneIds);
					const nodeTabs = state.tabs.filter(
						(t) => t.nodeId === nodeId,
					);

					const tab = {
						id: tabId,
						name: generateTabName(nodeTabs),
						nodeId,
						layout,
						createdAt: Date.now(),
					};

					const panesRecord: Record<string, (typeof panes)[number]> = {};
					for (const pane of panes) {
						panesRecord[pane.id] = pane;
					}

					const currentActiveId = state.activeTabIds[nodeId];
					const historyStack = state.tabHistoryStacks[nodeId] || [];
					const newHistoryStack = currentActiveId
						? [
								currentActiveId,
								...historyStack.filter((id) => id !== currentActiveId),
							]
						: historyStack;

					set({
						tabs: [...state.tabs, tab],
						panes: { ...state.panes, ...panesRecord },
						activeTabIds: {
							...state.activeTabIds,
							[nodeId]: tab.id,
						},
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tab.id]: paneIds[0],
						},
						tabHistoryStacks: {
							...state.tabHistoryStacks,
							[nodeId]: newHistoryStack,
						},
					});

					return { tabId: tab.id, paneIds };
				},

				removeTab: (tabId) => {
					const state = get();
					const tabToRemove = state.tabs.find((t) => t.id === tabId);
					if (!tabToRemove) return;

					const paneIds = getPaneIdsForTab(state.panes, tabId);
					for (const paneId of paneIds) {
						// Only kill terminal sessions for terminal panes (avoids unnecessary IPC for file-viewers)
						const pane = state.panes[paneId];
						if (pane?.type === "terminal") {
							killTerminalForPane(paneId);
						}
					}

					const newPanes = { ...state.panes };
					for (const paneId of paneIds) {
						delete newPanes[paneId];
					}

					const newTabs = state.tabs.filter((t) => t.id !== tabId);

					const nodeId = tabToRemove.nodeId;
					const newActiveTabIds = { ...state.activeTabIds };
					const newHistoryStack = (
						state.tabHistoryStacks[nodeId] || []
					).filter((id) => id !== tabId);

					if (state.activeTabIds[nodeId] === tabId) {
						newActiveTabIds[nodeId] = findNextTab(state, tabId);
					}

					const newFocusedPaneIds = { ...state.focusedPaneIds };
					delete newFocusedPaneIds[tabId];

					set({
						tabs: newTabs,
						panes: newPanes,
						activeTabIds: newActiveTabIds,
						focusedPaneIds: newFocusedPaneIds,
						tabHistoryStacks: {
							...state.tabHistoryStacks,
							[nodeId]: newHistoryStack,
						},
					});
				},

				renameTab: (tabId, newName) => {
					set((state) => ({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, userTitle: newName } : t,
						),
					}));
				},

				setTabAutoTitle: (tabId, title) => {
					set((state) => {
						const tab = state.tabs.find((t) => t.id === tabId);
						if (!tab || tab.name === title) return state;
						return {
							tabs: state.tabs.map((t) =>
								t.id === tabId ? { ...t, name: title } : t,
							),
						};
					});
				},

				setActiveTab: (nodeId, tabId) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab || tab.nodeId !== nodeId) {
						return;
					}

					const currentActiveId = state.activeTabIds[nodeId];
					const historyStack = state.tabHistoryStacks[nodeId] || [];

					let newHistoryStack = historyStack.filter((id) => id !== tabId);
					if (currentActiveId && currentActiveId !== tabId) {
						newHistoryStack = [
							currentActiveId,
							...newHistoryStack.filter((id) => id !== currentActiveId),
						];
					}

					// Clear attention status for panes in the selected tab
					const tabPaneIds = extractPaneIdsFromLayout(tab.layout);
					const newPanes = { ...state.panes };
					let hasChanges = false;
					for (const paneId of tabPaneIds) {
						const currentStatus = newPanes[paneId]?.status;
						if (currentStatus === "review") {
							// User acknowledged completion
							newPanes[paneId] = { ...newPanes[paneId], status: "idle" };
							hasChanges = true;
						} else if (currentStatus === "permission") {
							// Assume permission granted, agent is now working
							newPanes[paneId] = { ...newPanes[paneId], status: "working" };
							hasChanges = true;
						}
						// "working" status is NOT cleared by click - persists until Stop
					}

					set({
						activeTabIds: {
							...state.activeTabIds,
							[nodeId]: tabId,
						},
						tabHistoryStacks: {
							...state.tabHistoryStacks,
							[nodeId]: newHistoryStack,
						},
						...(hasChanges ? { panes: newPanes } : {}),
					});
				},

				reorderTabs: (nodeId, startIndex, endIndex) => {
					const state = get();
					const nodeTabs = state.tabs.filter(
						(t) => t.nodeId === nodeId,
					);
					const otherTabs = state.tabs.filter(
						(t) => t.nodeId !== nodeId,
					);

					// Prevent corrupting state by splicing undefined elements
					if (
						startIndex < 0 ||
						startIndex >= nodeTabs.length ||
						!Number.isInteger(startIndex)
					) {
						return;
					}

					// Prevent out-of-bounds writes that would insert undefined elements
					const clampedEndIndex = Math.max(
						0,
						Math.min(endIndex, nodeTabs.length),
					);

					// Avoid mutating original state array to prevent side effects elsewhere
					const reorderedTabs = [...nodeTabs];
					const [removed] = reorderedTabs.splice(startIndex, 1);
					reorderedTabs.splice(clampedEndIndex, 0, removed);

					set({ tabs: [...otherTabs, ...reorderedTabs] });
				},

				reorderTabById: (tabId, targetIndex) => {
					const state = get();
					const tabToMove = state.tabs.find((t) => t.id === tabId);
					if (!tabToMove) return;

					const nodeId = tabToMove.nodeId;
					const nodeTabs = state.tabs.filter(
						(t) => t.nodeId === nodeId,
					);
					const otherTabs = state.tabs.filter(
						(t) => t.nodeId !== nodeId,
					);

					const currentIndex = nodeTabs.findIndex((t) => t.id === tabId);
					if (currentIndex === -1) return;

					nodeTabs.splice(currentIndex, 1);
					nodeTabs.splice(targetIndex, 0, tabToMove);

					set({ tabs: [...otherTabs, ...nodeTabs] });
				},

				updateTabLayout: (tabId, layout) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab) return;

					// Early return if layout hasn't changed (prevents infinite loops)
					// For simple string layouts (single pane), use reference equality
					// For complex layouts, compare stringified versions
					if (typeof layout === "string" && typeof tab.layout === "string") {
						if (layout === tab.layout) return;
					} else if (JSON.stringify(layout) === JSON.stringify(tab.layout)) {
						return;
					}

					const newPaneIds = new Set(extractPaneIdsFromLayout(layout));
					const oldPaneIds = new Set(extractPaneIdsFromLayout(tab.layout));

					const removedPaneIds = Array.from(oldPaneIds).filter(
						(id) => !newPaneIds.has(id),
					);

					const newPanes = { ...state.panes };
					for (const paneId of removedPaneIds) {
						const pane = state.panes[paneId];
						// Only delete panes that actually belong to this tab
						// During drag operations, Mosaic may temporarily include foreign panes
						// in layouts - we must not delete those when they're "removed"
						if (pane && pane.tabId === tabId) {
							if (pane.type === "terminal") {
								killTerminalForPane(paneId);
							}
							delete newPanes[paneId];
						}
					}

					// Update focused pane if it was removed
					let newFocusedPaneIds = state.focusedPaneIds;
					const currentFocusedPaneId = state.focusedPaneIds[tabId];
					if (
						currentFocusedPaneId &&
						removedPaneIds.includes(currentFocusedPaneId)
					) {
						newFocusedPaneIds = {
							...state.focusedPaneIds,
							[tabId]: getFirstPaneId(layout),
						};
					}

					set({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, layout } : t,
						),
						panes: newPanes,
						focusedPaneIds: newFocusedPaneIds,
					});
				},

				// Pane operations
				addPane: (tabId, options?: CreatePaneOptions) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab) return "";

					const newPane = createPane(tabId, "terminal", options);

					const newLayout: MosaicNode<string> = {
						direction: "row",
						first: tab.layout,
						second: newPane.id,
						splitPercentage: 50,
					};

					set({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, layout: newLayout } : t,
						),
						panes: { ...state.panes, [newPane.id]: newPane },
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tabId]: newPane.id,
						},
					});

					return newPane.id;
				},

				addPanesToTab: (
					tabId: string,
					options: AddTabWithMultiplePanesOptions,
				) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab) return [];

					const panes: ReturnType<typeof createPane>[] = options.commands.map(
						(command) =>
							createPane(tabId, "terminal", {
								initialCommands: [command],
								initialCwd: options.initialCwd,
							}),
					);

					const paneIds = panes.map((p) => p.id);
					const existingPaneIds = extractPaneIdsFromLayout(tab.layout);
					const allPaneIds = [...existingPaneIds, ...paneIds];
					const newLayout = buildMultiPaneLayout(allPaneIds);

					const panesRecord: Record<string, (typeof panes)[number]> = {
						...state.panes,
					};
					for (const pane of panes) {
						panesRecord[pane.id] = pane;
					}

					set({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, layout: newLayout } : t,
						),
						panes: panesRecord,
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tabId]: paneIds[0],
						},
					});

					return paneIds;
				},

				addFileViewerPane: (
					nodeId: string,
					options: AddFileViewerPaneOptions,
				) => {
					const state = get();

					// If forceNewTab is true, always create a new tab
					if (options.forceNewTab) {
						const { tabId, paneId } = get().addTab(nodeId);
						const fileViewerPane = createFileViewerPane(tabId, {
							...options,
							isPinned: true, // Files opened in new tabs should be pinned
						});
						const fileName =
							options.filePath.split("/").pop() || options.filePath;
						set((s) => ({
							tabs: s.tabs.map((t) =>
								t.id === tabId ? { ...t, name: fileName } : t,
							),
							panes: {
								...s.panes,
								[paneId]: {
									...fileViewerPane,
									id: paneId,
								},
							},
						}));
						return paneId;
					}

					const resolvedActiveTabId = resolveActiveTabIdForNode({
						nodeId,
						tabs: state.tabs,
						activeTabIds: state.activeTabIds,
						tabHistoryStacks: state.tabHistoryStacks,
					});
					const activeTab = resolvedActiveTabId
						? state.tabs.find((t) => t.id === resolvedActiveTabId)
						: null;

					// If no active tab, create a new one (this shouldn't normally happen)
					if (!activeTab) {
						const { tabId, paneId } = get().addTab(nodeId);
						// Update the pane to be a file-viewer (must use set() to get fresh state after addTab)
						const fileViewerPane = createFileViewerPane(tabId, options);
						set((s) => ({
							panes: {
								...s.panes,
								[paneId]: {
									...fileViewerPane,
									id: paneId, // Keep the original ID
								},
							},
						}));
						return paneId;
					}

					const tabPaneIds = extractPaneIdsFromLayout(activeTab.layout);

					// First, check if the file is already open in a pinned pane - if so, just focus it
					const existingPinnedPane = tabPaneIds
						.map((id) => state.panes[id])
						.find(
							(p) =>
								p?.type === "file-viewer" &&
								p.fileViewer?.isPinned &&
								p.fileViewer.filePath === options.filePath &&
								p.fileViewer.diffCategory === options.diffCategory &&
								p.fileViewer.commitHash === options.commitHash,
						);

					if (existingPinnedPane) {
						// File is already open in a pinned pane, just focus it
						set({
							focusedPaneIds: {
								...state.focusedPaneIds,
								[activeTab.id]: existingPinnedPane.id,
							},
						});
						return existingPinnedPane.id;
					}

					// Look for an existing unpinned (preview) file-viewer pane in the active tab
					const fileViewerPanes = tabPaneIds
						.map((id) => state.panes[id])
						.filter(
							(p) =>
								p?.type === "file-viewer" &&
								p.fileViewer &&
								!p.fileViewer.isPinned,
						);

					// If we found an unpinned (preview) file-viewer pane, reuse it
					if (fileViewerPanes.length > 0) {
						const paneToReuse = fileViewerPanes[0];
						const existingFileViewer = paneToReuse.fileViewer;
						if (!existingFileViewer) {
							// Should not happen due to filter above, but satisfy type checker
							return "";
						}

						// If clicking the same file that's already in preview, just focus it
						const isSameFile =
							existingFileViewer.filePath === options.filePath &&
							existingFileViewer.diffCategory === options.diffCategory &&
							existingFileViewer.commitHash === options.commitHash;

						if (isSameFile) {
							if (
								options.viewMode &&
								existingFileViewer.viewMode !== options.viewMode
							) {
								set({
									panes: {
										...state.panes,
										[paneToReuse.id]: {
											...paneToReuse,
											fileViewer: {
												...existingFileViewer,
												viewMode: options.viewMode,
											},
										},
									},
									focusedPaneIds: {
										...state.focusedPaneIds,
										[activeTab.id]: paneToReuse.id,
									},
								});
								return paneToReuse.id;
							}
							set({
								focusedPaneIds: {
									...state.focusedPaneIds,
									[activeTab.id]: paneToReuse.id,
								},
							});
							return paneToReuse.id;
						}

						// Different file - replace the preview pane content
						const fileName =
							options.filePath.split("/").pop() || options.filePath;

						const viewMode = resolveFileViewerMode({
							filePath: options.filePath,
							diffCategory: options.diffCategory,
							viewMode: options.viewMode,
						});

						set({
							panes: {
								...state.panes,
								[paneToReuse.id]: {
									...paneToReuse,
									name: fileName,
									fileViewer: {
										filePath: options.filePath,
										viewMode,
										isPinned: options.isPinned ?? false,
										diffLayout: "inline",
										diffCategory: options.diffCategory,
										commitHash: options.commitHash,
										oldPath: options.oldPath,
										initialLine: options.line,
										initialColumn: options.column,
									},
								},
							},
							focusedPaneIds: {
								...state.focusedPaneIds,
								[activeTab.id]: paneToReuse.id,
							},
						});

						return paneToReuse.id;
					}

					// No reusable pane found, create a new one
					const newPane = createFileViewerPane(activeTab.id, options);

					const newLayout: MosaicNode<string> = {
						direction: "row",
						first: activeTab.layout,
						second: newPane.id,
						splitPercentage: 50,
					};

					set({
						tabs: state.tabs.map((t) =>
							t.id === activeTab.id ? { ...t, layout: newLayout } : t,
						),
						panes: { ...state.panes, [newPane.id]: newPane },
						focusedPaneIds: {
							...state.focusedPaneIds,
							[activeTab.id]: newPane.id,
						},
					});

					return newPane.id;
				},

				removePane: (paneId) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane) return;

					const tab = state.tabs.find((t) => t.id === pane.tabId);
					if (!tab) return;

					// If this is the last pane, remove the entire tab
					if (isLastPaneInTab(state.panes, tab.id)) {
						get().removeTab(tab.id);
						return;
					}

					// Must get adjacent pane BEFORE removing from layout
					const adjacentPaneId = getAdjacentPaneId(tab.layout, paneId);

					// Only kill terminal sessions for terminal panes (avoids unnecessary IPC for file-viewers)
					if (pane.type === "terminal") {
						killTerminalForPane(paneId);
					}

					const newLayout = removePaneFromLayout(tab.layout, paneId);
					if (!newLayout) {
						// This shouldn't happen since we checked isLastPaneInTab
						get().removeTab(tab.id);
						return;
					}

					const newPanes = { ...state.panes };
					delete newPanes[paneId];

					let newFocusedPaneIds = state.focusedPaneIds;
					if (state.focusedPaneIds[tab.id] === paneId) {
						newFocusedPaneIds = {
							...state.focusedPaneIds,
							[tab.id]: adjacentPaneId ?? getFirstPaneId(newLayout),
						};
					}

					set({
						tabs: state.tabs.map((t) =>
							t.id === tab.id ? { ...t, layout: newLayout } : t,
						),
						panes: newPanes,
						focusedPaneIds: newFocusedPaneIds,
					});
				},

				setFocusedPane: (tabId, paneId) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane || pane.tabId !== tabId) return;

					set({
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tabId]: paneId,
						},
					});
				},

				markPaneAsUsed: (paneId) => {
					set((state) => {
						const pane = state.panes[paneId];
						if (!pane || pane.isNew === false) return state;
						return {
							panes: {
								...state.panes,
								[paneId]: { ...pane, isNew: false },
							},
						};
					});
				},

				setPaneStatus: (paneId, status) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane || pane.status === status) return;

					set({
						panes: {
							...state.panes,
							[paneId]: { ...pane, status },
						},
					});
				},

				setPaneName: (paneId, name) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane || pane.name === name) return;

					set({
						panes: {
							...state.panes,
							[paneId]: { ...pane, name },
						},
					});
				},

				setPaneLastCompleted: (paneId) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane) return;

					set({
						panes: {
							...state.panes,
							[paneId]: { ...pane, lastCompletedAt: Date.now() },
						},
					});
				},

				clearNodeAttentionStatus: (nodeId) => {
					const state = get();
					const nodeTabs = state.tabs.filter(
						(t) => t.nodeId === nodeId,
					);
					const nodePaneIds = nodeTabs.flatMap((t) =>
						extractPaneIdsFromLayout(t.layout),
					);

					if (nodePaneIds.length === 0) {
						return;
					}

					const newPanes = { ...state.panes };
					let hasChanges = false;
					for (const paneId of nodePaneIds) {
						const currentStatus = newPanes[paneId]?.status;
						if (currentStatus === "review") {
							// User acknowledged completion
							newPanes[paneId] = { ...newPanes[paneId], status: "idle" };
							hasChanges = true;
						} else if (currentStatus === "permission") {
							// Assume permission granted, Claude is now working
							newPanes[paneId] = { ...newPanes[paneId], status: "working" };
							hasChanges = true;
						}
						// "working" status is NOT cleared by click - persists until Stop
					}

					if (hasChanges) {
						set({ panes: newPanes });
					}
				},

				updatePaneCwd: (paneId, cwd, confirmed) => {
					set((state) => {
						const pane = state.panes[paneId];
						if (!pane) return state;
						if (pane.cwd === cwd && pane.cwdConfirmed === confirmed) {
							return state;
						}
						return {
							panes: {
								...state.panes,
								[paneId]: {
									...pane,
									cwd,
									cwdConfirmed: confirmed,
								},
							},
						};
					});
				},

				clearPaneInitialData: (paneId) => {
					set((state) => {
						const pane = state.panes[paneId];
						if (!pane) return state;
						if (
							pane.initialCommands === undefined &&
							pane.initialCwd === undefined
						) {
							return state;
						}
						return {
							panes: {
								...state.panes,
								[paneId]: {
									...pane,
									initialCommands: undefined,
									initialCwd: undefined,
								},
							},
						};
					});
				},

				pinPane: (paneId) => {
					set((state) => {
						const pane = state.panes[paneId];
						if (!pane?.fileViewer) return state;
						if (pane.fileViewer.isPinned) return state;
						return {
							panes: {
								...state.panes,
								[paneId]: {
									...pane,
									fileViewer: {
										...pane.fileViewer,
										isPinned: true,
									},
								},
							},
						};
					});
				},

				// Split operations
				splitPaneVertical: (tabId, sourcePaneId, path, options) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab) return;

					const sourcePane = state.panes[sourcePaneId];
					if (!sourcePane || sourcePane.tabId !== tabId) return;

					// Always create a new terminal when splitting
					const newPane = createPane(tabId, "terminal", options);

					let newLayout: MosaicNode<string>;
					if (path && path.length > 0) {
						// Split at a specific path in the layout
						newLayout = updateTree(tab.layout, [
							{
								path,
								spec: {
									$set: {
										direction: "row",
										first: sourcePaneId,
										second: newPane.id,
										splitPercentage: 50,
									},
								},
							},
						]);
					} else {
						// Split the pane directly
						newLayout = {
							direction: "row",
							first: tab.layout,
							second: newPane.id,
							splitPercentage: 50,
						};
					}

					set({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, layout: newLayout } : t,
						),
						panes: { ...state.panes, [newPane.id]: newPane },
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tabId]: newPane.id,
						},
					});
				},

				splitPaneHorizontal: (tabId, sourcePaneId, path, options) => {
					const state = get();
					const tab = state.tabs.find((t) => t.id === tabId);
					if (!tab) return;

					const sourcePane = state.panes[sourcePaneId];
					if (!sourcePane || sourcePane.tabId !== tabId) return;

					// Always create a new terminal when splitting
					const newPane = createPane(tabId, "terminal", options);

					let newLayout: MosaicNode<string>;
					if (path && path.length > 0) {
						// Split at a specific path in the layout
						newLayout = updateTree(tab.layout, [
							{
								path,
								spec: {
									$set: {
										direction: "column",
										first: sourcePaneId,
										second: newPane.id,
										splitPercentage: 50,
									},
								},
							},
						]);
					} else {
						// Split the pane directly
						newLayout = {
							direction: "column",
							first: tab.layout,
							second: newPane.id,
							splitPercentage: 50,
						};
					}

					set({
						tabs: state.tabs.map((t) =>
							t.id === tabId ? { ...t, layout: newLayout } : t,
						),
						panes: { ...state.panes, [newPane.id]: newPane },
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tabId]: newPane.id,
						},
					});
				},

				splitPaneAuto: (tabId, sourcePaneId, dimensions, path, options) => {
					if (dimensions.width >= dimensions.height) {
						get().splitPaneVertical(tabId, sourcePaneId, path, options);
					} else {
						get().splitPaneHorizontal(tabId, sourcePaneId, path, options);
					}
				},

				movePaneToTab: (paneId, targetTabId) => {
					const result = movePaneToTab(get(), paneId, targetTabId);
					if (result) set(result);
				},

				movePaneToNewTab: (paneId) => {
					const state = get();
					const pane = state.panes[paneId];
					if (!pane) return "";

					const sourceTab = state.tabs.find((t) => t.id === pane.tabId);
					if (!sourceTab) return "";

					// Already in its own tab
					if (isLastPaneInTab(state.panes, sourceTab.id)) return sourceTab.id;

					const moveResult = movePaneToNewTab(state, paneId);
					if (!moveResult) return "";

					set(moveResult.result);
					return moveResult.newTabId;
				},

				// Query helpers
				getTabsByNode: (nodeId) => {
					return get().tabs.filter((t) => t.nodeId === nodeId);
				},

				getActiveTab: (nodeId) => {
					const state = get();
					const activeTabId = resolveActiveTabIdForNode({
						nodeId,
						tabs: state.tabs,
						activeTabIds: state.activeTabIds,
						tabHistoryStacks: state.tabHistoryStacks,
					});
					if (!activeTabId) return null;
					return state.tabs.find((t) => t.id === activeTabId) || null;
				},

				getPanesForTab: (tabId) => {
					const state = get();
					return Object.values(state.panes).filter((p) => p.tabId === tabId);
				},

				getFocusedPane: (tabId) => {
					const state = get();
					const focusedPaneId = state.focusedPaneIds[tabId];
					if (!focusedPaneId) return null;
					return state.panes[focusedPaneId] || null;
				},

				openKanbanDashboard: (nodeId: string) => {
					const state = get();

					// Check if kanban tab already exists for this node
					const existingKanbanPane = Object.values(state.panes).find(
						(p) => p.type === "kanban",
					);

					if (existingKanbanPane) {
						const existingTab = state.tabs.find(
							(t) => t.id === existingKanbanPane.tabId,
						);
						if (existingTab && existingTab.nodeId === nodeId) {
							// Activate existing tab
							set({
								activeTabIds: {
									...state.activeTabIds,
									[nodeId]: existingTab.id,
								},
							});
							return { tabId: existingTab.id, paneId: existingKanbanPane.id };
						}
					}

					// Create new kanban tab
					const tabId = generateId("tab");
					const pane = createKanbanPane(tabId);

					const tab = {
						id: tabId,
						name: "Agent Dashboard",
						nodeId,
						layout: pane.id,
						createdAt: Date.now(),
					};

					const currentActiveId = state.activeTabIds[nodeId];
					const historyStack = state.tabHistoryStacks[nodeId] || [];
					const newHistoryStack = currentActiveId
						? [
								currentActiveId,
								...historyStack.filter((id) => id !== currentActiveId),
							]
						: historyStack;

					set({
						tabs: [...state.tabs, tab],
						panes: { ...state.panes, [pane.id]: pane },
						activeTabIds: {
							...state.activeTabIds,
							[nodeId]: tab.id,
						},
						focusedPaneIds: {
							...state.focusedPaneIds,
							[tab.id]: pane.id,
						},
						tabHistoryStacks: {
							...state.tabHistoryStacks,
							[nodeId]: newHistoryStack,
						},
					});

					return { tabId: tab.id, paneId: pane.id };
				},
			}),
			{
				name: "tabs-storage",
				version: 3,
				storage: trpcTabsStorage,
				migrate: (persistedState, version) => {
					const state = persistedState as TabsState;
					if (version < 2 && state.panes) {
						// Migrate needsAttention → status
						for (const pane of Object.values(state.panes)) {
							// biome-ignore lint/suspicious/noExplicitAny: migration from old schema
							const legacyPane = pane as any;
							if (legacyPane.needsAttention === true) {
								pane.status = "review";
							}
							delete legacyPane.needsAttention;
						}
					}
					if (version < 3 && state.panes) {
						// Migrate isLocked → isPinned
						for (const pane of Object.values(state.panes)) {
							if (pane.fileViewer) {
								// biome-ignore lint/suspicious/noExplicitAny: migration from old schema
								const legacyFileViewer = pane.fileViewer as any;
								// Default old panes to pinned (they were explicitly opened)
								pane.fileViewer.isPinned = legacyFileViewer.isLocked ?? true;
								delete legacyFileViewer.isLocked;
							}
						}
					}
					return state;
				},
				merge: (persistedState, currentState) => {
					const persisted = persistedState as TabsState;
					// Clear stale transient statuses on startup:
					// - "working": Agent can't be working if app just restarted
					// - "permission": Permission dialog is gone after restart
					// Note: "review" is intentionally preserved so users see missed completions
					if (persisted.panes) {
						for (const pane of Object.values(persisted.panes)) {
							if (pane.status === "working" || pane.status === "permission") {
								pane.status = "idle";
							}
						}
					}

					const mergedState = { ...currentState, ...persisted };

					// Sanitize persisted tab pointers to be node-scoped.
					// This prevents cross-node rendering when state is stale/corrupt.
					const tabIds = new Set(mergedState.tabs.map((t) => t.id));
					const nodeTabIdSets = new Map<string, Set<string>>();
					for (const tab of mergedState.tabs) {
						let setForNode = nodeTabIdSets.get(tab.nodeId);
						if (!setForNode) {
							setForNode = new Set();
							nodeTabIdSets.set(tab.nodeId, setForNode);
						}
						setForNode.add(tab.id);
					}

					const nodeIds = new Set<string>([
						...Object.keys(mergedState.activeTabIds),
						...Object.keys(mergedState.tabHistoryStacks),
					]);
					for (const tab of mergedState.tabs) {
						nodeIds.add(tab.nodeId);
					}

					const nextActiveTabIds = { ...mergedState.activeTabIds };
					const nextHistoryStacks = { ...mergedState.tabHistoryStacks };

					for (const nodeId of nodeIds) {
						nextActiveTabIds[nodeId] = resolveActiveTabIdForNode({
							nodeId,
							tabs: mergedState.tabs,
							activeTabIds: mergedState.activeTabIds,
							tabHistoryStacks: mergedState.tabHistoryStacks,
						});

						const nodeTabIds = nodeTabIdSets.get(nodeId);
						const history = nextHistoryStacks[nodeId] ?? [];
						if (nodeTabIds && Array.isArray(history)) {
							nextHistoryStacks[nodeId] = history.filter((id) =>
								nodeTabIds.has(id),
							);
						}
					}

					const nextFocusedPaneIds = { ...mergedState.focusedPaneIds };
					for (const [tabId, paneId] of Object.entries(nextFocusedPaneIds)) {
						if (!tabIds.has(tabId)) {
							delete nextFocusedPaneIds[tabId];
							continue;
						}
						const pane = mergedState.panes[paneId];
						if (!pane || pane.tabId !== tabId) {
							delete nextFocusedPaneIds[tabId];
						}
					}

					return {
						...mergedState,
						activeTabIds: nextActiveTabIds,
						tabHistoryStacks: nextHistoryStacks,
						focusedPaneIds: nextFocusedPaneIds,
					};
				},
			},
		),
		{ name: "TabsStore" },
	),
);
