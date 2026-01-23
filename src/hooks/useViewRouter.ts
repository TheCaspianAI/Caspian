import { useCallback, useMemo } from 'react';
import { useUIStore, type ViewMode } from '../stores/uiStore';
import { useRepositoryStore } from '../stores/repositoryStore';
import { useNodeStore } from '../stores/nodeStore';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';
import { getNodeFromCache, getMessagesFromCache } from '../utils/nodeCache';

/**
 * useViewRouter - Centralized view routing hook
 *
 * Single source of truth for:
 * - Current view mode (home, controlRoom, workspace)
 * - Navigation actions (navigateHome, navigateToControlRoom, navigateToNode)
 * - View state booleans (isHome, isControlRoom, isWorkspace)
 *
 * PERFORMANCE: Uses optimistic rendering - shows cached data immediately,
 * revalidates in background. No skeleton needed for cache hits.
 */
export function useViewRouter() {
  // IMPORTANT: Use individual selectors to prevent cascading re-renders
  // Subscribing to entire stores causes all useViewRouter consumers to re-render
  // whenever ANY property in those stores changes
  const viewMode = useUIStore(state => state.viewMode);
  const setViewMode = useUIStore(state => state.setViewMode);
  const activeRepoId = useRepositoryStore(state => state.activeRepoId);
  const setActiveRepo = useRepositoryStore(state => state.setActiveRepo);
  const setActiveNode = useNodeStore(state => state.setActiveNode);
  const fetchNodes = useNodeStore(state => state.fetchNodes);

  // Derived boolean states for convenience
  const isHome = viewMode === 'home';
  const isControlRoom = viewMode === 'controlRoom';
  const isWorkspace = viewMode === 'workspace';

  // Navigate to home screen
  const navigateHome = useCallback(() => {
    setActiveRepo(null);
    setViewMode('home');
  }, [setActiveRepo, setViewMode]);

  // Navigate to control room
  const navigateToControlRoom = useCallback(() => {
    setViewMode('controlRoom');
  }, [setViewMode]);

  // Toggle control room (for keyboard shortcut)
  const toggleControlRoom = useCallback(() => {
    if (isControlRoom) {
      // Go back to previous view
      if (activeRepoId) {
        setViewMode('workspace');
      } else {
        setViewMode('home');
      }
    } else {
      setViewMode('controlRoom');
    }
  }, [isControlRoom, activeRepoId, setViewMode]);

  // Navigate to a specific node (enters workspace mode)
  // OPTIMISTIC RENDERING: Shows cached data immediately, no skeleton for cache hits
  const navigateToNode = useCallback((nodeId: string, repoId: string) => {
    // Capture whether repo is changing before any state updates
    const isRepoChanging = activeRepoId !== repoId;

    // Check cache status BEFORE any state changes
    const nodeCache = getNodeFromCache(nodeId);
    const messagesCache = getMessagesFromCache(nodeId);
    const agentStatusCache = useAgentStore.getState().nodeStatusFetchedAt[nodeId];
    const agentStatusFresh = agentStatusCache && (Date.now() - agentStatusCache) < 30_000;

    const allCachesFresh = nodeCache.status === 'fresh' &&
                           (messagesCache.status === 'fresh' || messagesCache.status === 'stale') &&
                           agentStatusFresh;

    // 1. Update all state synchronously for instant UI response
    if (isRepoChanging) {
      setActiveRepo(repoId);
    }
    setViewMode('workspace');

    // 2. Set active node (uses cache internally for instant display)
    setActiveNode(nodeId);

    // 3. Set chat context (uses cache internally for instant display)
    useChatStore.getState().setContext(repoId, nodeId);

    // 4. BACKGROUND: Revalidate data only if needed (truly non-blocking, fire-and-forget)
    if (!allCachesFresh && !agentStatusFresh) {
      // Use queueMicrotask to ensure we don't block the current frame at all
      queueMicrotask(() => {
        useAgentStore.getState().getAgentStatus(nodeId);
      });
    }

    // 5. Fetch nodes for sidebar if repo changed (background, non-blocking)
    if (isRepoChanging) {
      queueMicrotask(() => {
        fetchNodes(repoId);
      });
    }
  }, [activeRepoId, setActiveRepo, fetchNodes, setActiveNode, setViewMode]);

  // Navigate to workspace (just the mode, assumes repo/node already set)
  const navigateToWorkspace = useCallback(() => {
    setViewMode('workspace');
  }, [setViewMode]);

  // Check if workspace chrome should be shown (header, tabs, inspector)
  const showWorkspaceChrome = useMemo(() => {
    return isWorkspace && activeRepoId !== null;
  }, [isWorkspace, activeRepoId]);

  return {
    // Current state
    viewMode,
    activeRepoId,

    // Boolean helpers
    isHome,
    isControlRoom,
    isWorkspace,
    showWorkspaceChrome,

    // Navigation actions
    navigateHome,
    navigateToControlRoom,
    toggleControlRoom,
    navigateToNode,
    navigateToWorkspace,

    // Low-level setter (use sparingly)
    setViewMode,
  };
}

/**
 * Selector for just the view mode (for components that only need to read)
 */
export function useCurrentView(): ViewMode {
  return useUIStore(state => state.viewMode);
}
