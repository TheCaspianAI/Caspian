import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export enum SidebarTab {
	Nodes = "nodes",
	Changes = "changes",
	Files = "files",
}

const DEFAULT_SIDEBAR_WIDTH = 250;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 500;
export const COLLAPSED_SIDEBAR_WIDTH = 52;
const SNAP_THRESHOLD = 120;

interface SidebarState {
	isSidebarOpen: boolean;
	isSidebarCollapsed: boolean;
	sidebarWidth: number;
	lastOpenSidebarWidth: number;
	isResizing: boolean;
	activeSidebarTab: SidebarTab;

	toggleSidebar: () => void;
	setSidebarOpen: (open: boolean) => void;
	setSidebarWidth: (width: number) => void;
	setIsResizing: (isResizing: boolean) => void;
	setActiveSidebarTab: (tab: SidebarTab) => void;
}

export const useSidebarStore = create<SidebarState>()(
	devtools(
		persist(
			(set, get) => ({
				isSidebarOpen: true,
				isSidebarCollapsed: false,
				sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
				lastOpenSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
				isResizing: false,
				activeSidebarTab: SidebarTab.Nodes,

				toggleSidebar: () => {
					const { isSidebarOpen, isSidebarCollapsed, lastOpenSidebarWidth } = get();
					if (isSidebarOpen && !isSidebarCollapsed) {
						set({
							isSidebarOpen: false,
							isSidebarCollapsed: false,
							sidebarWidth: 0,
						});
					} else {
						set({
							isSidebarOpen: true,
							isSidebarCollapsed: false,
							sidebarWidth: lastOpenSidebarWidth,
						});
					}
				},

				setSidebarOpen: (open) => {
					const { lastOpenSidebarWidth } = get();
					if (open) {
						set({
							isSidebarOpen: true,
							isSidebarCollapsed: false,
							sidebarWidth: lastOpenSidebarWidth,
						});
					} else {
						set({
							isSidebarOpen: false,
							isSidebarCollapsed: false,
							sidebarWidth: 0,
						});
					}
				},

				setSidebarWidth: (width) => {
					if (width <= SNAP_THRESHOLD) {
						set({
							sidebarWidth: COLLAPSED_SIDEBAR_WIDTH,
							isSidebarOpen: true,
							isSidebarCollapsed: true,
						});
						return;
					}

					const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
					set({
						sidebarWidth: clampedWidth,
						lastOpenSidebarWidth: clampedWidth,
						isSidebarOpen: true,
						isSidebarCollapsed: false,
					});
				},

				setIsResizing: (isResizing) => {
					set({ isResizing });
				},

				setActiveSidebarTab: (tab) => {
					set({ activeSidebarTab: tab });
				},
			}),
			{
				name: "sidebar-store",
				migrate: (persistedState: unknown, _version: number) => {
					const state = persistedState as Record<string, unknown>;
					// Convert old percentage-based values (<100) to pixel widths
					if (typeof state.sidebarWidth === "number" && state.sidebarWidth < 100) {
						state.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
						state.lastOpenSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
					}
					// Ensure collapsed state exists
					if (state.isSidebarCollapsed === undefined) {
						state.isSidebarCollapsed = false;
					}
					// Migrate activeSidebarTab from old rightSidebarTab if present
					if (state.activeSidebarTab === undefined) {
						const oldTab = state.rightSidebarTab as string | undefined;
						if (oldTab === "changes" || oldTab === "files") {
							state.activeSidebarTab = oldTab;
						} else {
							state.activeSidebarTab = "nodes";
						}
					}
					// Remove old right-panel and other legacy fields
					delete state.isRightPanelOpen;
					delete state.rightPanelWidth;
					delete state.lastOpenRightPanelWidth;
					delete state.isRightPanelResizing;
					delete state.rightSidebarTab;
					delete state.currentMode;
					delete state.lastMode;
					return state as unknown as SidebarState;
				},
				version: 4,
			},
		),
		{ name: "SidebarStore" },
	),
);
