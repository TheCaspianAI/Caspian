import { useCallback } from 'react';
import { useNodeStore } from '../stores/nodeStore';

/**
 * Actions hook that guarantees fresh state access via getState()
 *
 * Use this for callbacks that need to read node state without stale closure issues.
 * The getState() pattern ensures we always read the current store state at execution time,
 * rather than relying on closure-captured values that may be stale.
 */
export function useNodeActions() {
  // Fresh state accessor - always returns current state
  const getActiveNodeState = useCallback(() => {
    return useNodeStore.getState().activeNodeState;
  }, []);

  // Safe typed accessor with automatic narrowing
  const getActiveNode = useCallback(() => {
    const state = getActiveNodeState();
    if (state.status === 'ready') {
      return { nodeId: state.nodeId, node: state.node };
    }
    return null;
  }, [getActiveNodeState]);

  // Validation helper for message sending (used in ChatTimeline)
  // Returns a discriminated union for type-safe access
  const canSendMessage = useCallback(():
    | { canSend: false; reason: string }
    | { canSend: true; node: import('../types').Node; nodeId: string } => {
    const state = getActiveNodeState();

    if (state.status !== 'ready') {
      const reason = state.status === 'loading'
        ? 'Node is loading...'
        : state.status === 'error'
        ? `Node failed to load: ${state.error}`
        : 'No node selected';
      return { canSend: false, reason };
    }

    const { node, nodeId } = state;
    if (node.node.worktree_status !== 'ready') {
      const reason = node.node.worktree_status === 'creating'
        ? 'Worktree is being created...'
        : node.node.worktree_status === 'failed'
        ? 'Worktree creation failed. Try retrying from the sidebar.'
        : 'Worktree is not ready yet.';
      return { canSend: false, reason };
    }

    return { canSend: true, node: node.node, nodeId };
  }, [getActiveNodeState]);

  // Store action passthroughs - these use getState() for fresh access
  const setActiveNode = useCallback(async (id: string | null) => {
    return useNodeStore.getState().setActiveNode(id);
  }, []);

  const createNode = useCallback(async (repoId: string, goal: string, parent?: string) => {
    return useNodeStore.getState().createNode(repoId, goal, parent);
  }, []);

  const deleteNode = useCallback(async (id: string, force?: boolean) => {
    return useNodeStore.getState().deleteNode(id, force);
  }, []);

  const updateDisplayName = useCallback(async (id: string, displayName: string) => {
    return useNodeStore.getState().updateDisplayName(id, displayName);
  }, []);

  return {
    // Fresh state accessors
    getActiveNodeState,
    getActiveNode,
    canSendMessage,

    // Store action passthroughs
    setActiveNode,
    createNode,
    deleteNode,
    updateDisplayName,
  };
}
