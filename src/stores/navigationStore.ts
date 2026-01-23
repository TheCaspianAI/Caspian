import { create } from 'zustand';

/**
 * Navigation phases for the state machine:
 * - idle: No navigation in progress
 * - navigating: Navigation started, skeleton shown, data loading
 * - ready: Data loaded, ChatTimeline can mount and render
 */
type NavigationPhase = 'idle' | 'navigating' | 'ready';

interface NavigationState {
  phase: NavigationPhase;
  targetNodeId: string | null;
  targetRepoId: string | null;

  // Actions
  startNavigation: (nodeId: string, repoId: string) => void;
  completeNavigation: () => void;
  reset: () => void;
}

/**
 * Navigation Store - State machine for coordinating node navigation
 *
 * This store controls when ChatTimeline is allowed to mount/render,
 * preventing cascading re-renders during navigation by gating the
 * heavy component until all data is ready.
 *
 * Flow:
 * 1. startNavigation() - Shows skeleton, begins data loading
 * 2. completeNavigation() - Data ready, mounts ChatTimeline
 * 3. reset() - Returns to idle (used when leaving workspace)
 */
export const useNavigationStore = create<NavigationState>((set) => ({
  phase: 'idle',
  targetNodeId: null,
  targetRepoId: null,

  startNavigation: (nodeId, repoId) => set({
    phase: 'navigating',
    targetNodeId: nodeId,
    targetRepoId: repoId,
  }),

  completeNavigation: () => set({ phase: 'ready' }),

  reset: () => set({
    phase: 'idle',
    targetNodeId: null,
    targetRepoId: null,
  }),
}));
