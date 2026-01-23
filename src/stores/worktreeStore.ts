import { create } from 'zustand';
import { safeListen, safeInvoke, isTauri } from '../utils/tauri';
import type { WorktreeProgressEvent, WorktreeStatus, CommandResult } from '../types';
import { useNodeStore } from './nodeStore';

type UnlistenFn = () => void;

interface WorktreeOperation {
  nodeId: string;
  status: WorktreeStatus;
  progress: number;
  message?: string;
  attempt: number;
  maxAttempts: number;
  timestamp: number;
}

interface WorktreeStoreState {
  // Track in-progress operations
  operations: Record<string, WorktreeOperation>;

  // Subscription management
  isSubscribed: boolean;
  unlistenFns: UnlistenFn[];

  // Actions
  subscribeToWorktreeEvents: () => Promise<void>;
  unsubscribe: () => void;
  retryWorktreeCreation: (nodeId: string) => Promise<boolean>;
  getOperationStatus: (nodeId: string) => WorktreeOperation | null;
  clearOperation: (nodeId: string) => void;
}

export const useWorktreeStore = create<WorktreeStoreState>((set, get) => ({
  operations: {},
  isSubscribed: false,
  unlistenFns: [],

  subscribeToWorktreeEvents: async () => {
    // Guard: only subscribe once
    if (get().isSubscribed) {
      return;
    }

    // Clear any stale listeners first
    const { unlistenFns } = get();
    if (unlistenFns.length > 0) {
      unlistenFns.forEach((fn) => fn());
    }

    // Subscribe to global worktree progress events
    const progressUnlisten = await safeListen<WorktreeProgressEvent>(
      'worktree:progress',
      (payload) => {
        const nodeId = payload.node_id;

        // Update operations state
        set((state) => ({
          operations: {
            ...state.operations,
            [nodeId]: {
              nodeId,
              status: payload.status,
              progress: payload.progress,
              message: payload.message,
              attempt: payload.attempt,
              maxAttempts: payload.max_attempts,
              timestamp: Date.now(),
            },
          },
        }));

        // Update node store with new worktree status
        const nodeStore = useNodeStore.getState();
        const node = nodeStore.nodes.find((n) => n.id === nodeId);

        if (node && node.worktree_status !== payload.status) {
          // Refresh node data from backend when status changes to ready or failed
          if (payload.status === 'ready' || payload.status === 'failed') {
            nodeStore.fetchNode(nodeId);

            // Also refresh the node list if we have the repo_id
            if (node.repo_id) {
              nodeStore.fetchNodes(node.repo_id);
            }
          } else {
            // For intermediate states, just update local state
            useNodeStore.setState((state) => ({
              nodes: state.nodes.map((n) =>
                n.id === nodeId ? { ...n, worktree_status: payload.status } : n
              ),
              activeNodeState:
                state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === nodeId
                  ? {
                      ...state.activeNodeState,
                      node: {
                        ...state.activeNodeState.node,
                        node: { ...state.activeNodeState.node.node, worktree_status: payload.status },
                      },
                    }
                  : state.activeNodeState,
            }));
          }
        }

        // Clean up completed operations after a delay
        if (payload.status === 'ready' || payload.status === 'failed') {
          setTimeout(() => {
            get().clearOperation(nodeId);
          }, 3000);
        }
      }
    );

    const listeners: UnlistenFn[] = [];
    if (progressUnlisten) {
      listeners.push(progressUnlisten);
    }

    set({
      unlistenFns: listeners,
      isSubscribed: true,
    });
  },

  unsubscribe: () => {
    const { unlistenFns } = get();
    unlistenFns.forEach((unlisten) => unlisten());
    set({
      unlistenFns: [],
      isSubscribed: false,
    });
  },

  retryWorktreeCreation: async (nodeId: string) => {
    if (!isTauri()) {
      console.warn('[WorktreeStore] Not in Tauri environment');
      return false;
    }

    try {
      const result = await safeInvoke<CommandResult<void>>('retry_worktree_creation', {
        nodeId,
      });

      if (result?.success) {
        return true;
      } else {
        console.error('[WorktreeStore] Retry failed:', result?.error);
        return false;
      }
    } catch (error) {
      console.error('[WorktreeStore] Retry error:', error);
      return false;
    }
  },

  getOperationStatus: (nodeId: string) => {
    return get().operations[nodeId] || null;
  },

  clearOperation: (nodeId: string) => {
    set((state) => {
      const newOperations = { ...state.operations };
      delete newOperations[nodeId];
      return { operations: newOperations };
    });
  },
}));

// Helper hook for getting worktree status with progress info
export function useWorktreeProgress(nodeId: string | undefined): WorktreeOperation | null {
  const operation = useWorktreeStore((state) =>
    nodeId ? state.operations[nodeId] || null : null
  );
  return operation;
}

// Helper to check if a node's worktree is ready for use
export function isWorktreeReady(worktreeStatus: WorktreeStatus | undefined): boolean {
  return worktreeStatus === 'ready' || worktreeStatus === undefined;
}
