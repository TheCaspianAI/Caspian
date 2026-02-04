import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const DEFAULT_NODE_SIDEBAR_WIDTH = 280;
export const COLLAPSED_NODE_SIDEBAR_WIDTH = 52;
const MIN_NODE_SIDEBAR_WIDTH = 220;
export const MAX_NODE_SIDEBAR_WIDTH = 400;

// Threshold for snapping to collapsed state
const COLLAPSE_THRESHOLD = 120;

interface NodeSidebarState {
	isOpen: boolean;
	width: number;
	lastExpandedWidth: number;
	// Use string[] instead of Set<string> for JSON serialization with Zustand persist
	collapsedRepositoryIds: string[];
	isResizing: boolean;

	toggleOpen: () => void;
	setOpen: (open: boolean) => void;
	setWidth: (width: number) => void;
	setIsResizing: (isResizing: boolean) => void;
	toggleRepositoryCollapsed: (repositoryId: string) => void;
	isRepositoryCollapsed: (repositoryId: string) => boolean;
	toggleCollapsed: () => void;
	isCollapsed: () => boolean;
}

export const useNodeSidebarStore = create<NodeSidebarState>()(
	devtools(
		persist(
			(set, get) => ({
				isOpen: true,
				width: DEFAULT_NODE_SIDEBAR_WIDTH,
				lastExpandedWidth: DEFAULT_NODE_SIDEBAR_WIDTH,
				collapsedRepositoryIds: [],
				isResizing: false,

				toggleOpen: () => {
					const { isOpen, lastExpandedWidth } = get();
					if (isOpen) {
						set({ isOpen: false, width: 0 });
					} else {
						set({
							isOpen: true,
							width: lastExpandedWidth,
						});
					}
				},

				setOpen: (open) => {
					const { lastExpandedWidth } = get();
					set({
						isOpen: open,
						width: open ? lastExpandedWidth : 0,
					});
				},

				setWidth: (width) => {
					// Snap to collapsed if below threshold (never allow closing completely via drag)
					if (width < COLLAPSE_THRESHOLD) {
						set({
							width: COLLAPSED_NODE_SIDEBAR_WIDTH,
							isOpen: true,
						});
						return;
					}

					// Clamp to expanded range
					const clampedWidth = Math.max(
						MIN_NODE_SIDEBAR_WIDTH,
						Math.min(MAX_NODE_SIDEBAR_WIDTH, width),
					);

					set({
						width: clampedWidth,
						lastExpandedWidth: clampedWidth,
						isOpen: true,
					});
				},

				setIsResizing: (isResizing) => {
					set({ isResizing });
				},

				toggleRepositoryCollapsed: (repositoryId) => {
					set((state) => ({
						collapsedRepositoryIds: state.collapsedRepositoryIds.includes(repositoryId)
							? state.collapsedRepositoryIds.filter((id) => id !== repositoryId)
							: [...state.collapsedRepositoryIds, repositoryId],
					}));
				},

				isRepositoryCollapsed: (repositoryId) => {
					return get().collapsedRepositoryIds.includes(repositoryId);
				},

				toggleCollapsed: () => {
					const { width, lastExpandedWidth } = get();
					const isCurrentlyCollapsed = width === COLLAPSED_NODE_SIDEBAR_WIDTH;

					if (isCurrentlyCollapsed) {
						set({ width: lastExpandedWidth });
					} else {
						set({ width: COLLAPSED_NODE_SIDEBAR_WIDTH });
					}
				},

				isCollapsed: () => {
					return get().width === COLLAPSED_NODE_SIDEBAR_WIDTH;
				},
			}),
			{
				name: "node-sidebar-store",
				version: 3,
				// Exclude ephemeral state from persistence
				partialize: (state) => ({
					isOpen: state.isOpen,
					width: state.width,
					lastExpandedWidth: state.lastExpandedWidth,
					collapsedRepositoryIds: state.collapsedRepositoryIds,
					// isResizing intentionally excluded - ephemeral UI state
				}),
				migrate: (persistedState, version) => {
					// biome-ignore lint/suspicious/noExplicitAny: migration from old schema
					const state = persistedState as any;
					if (version < 3 && state.collapsedProjectIds) {
						// Migrate collapsedProjectIds → collapsedRepositoryIds
						state.collapsedRepositoryIds = state.collapsedProjectIds;
						delete state.collapsedProjectIds;
					}
					return state;
				},
			},
		),
		{ name: "NodeSidebarStore" },
	),
);
