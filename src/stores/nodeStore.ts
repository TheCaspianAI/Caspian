import { create } from 'zustand';
import { safeInvoke, isTauri } from '../utils/tauri';
import {
  getNodeFromCache,
  setNodeInCache,
  invalidateNode,
  getAuditFromCache,
  setAuditInCache,
} from '../utils/nodeCache';
import { useUIStore } from './uiStore';
import type {
  Node,
  NodeWithManifest,
  NodeManifest,
  CommandResult,
  AuditEntry,
} from '../types';

// =============================================================================
// ATOMIC STATE MODEL
// Replaces separate activeNodeId + activeNode + isNodeLoading with single
// discriminated union that makes invalid states unrepresentable
// =============================================================================

export type ActiveNodeState =
  | { status: 'none' }
  | { status: 'loading'; nodeId: string }
  | { status: 'ready'; nodeId: string; node: NodeWithManifest }
  | { status: 'error'; nodeId: string; error: string };

// Type guard for discriminated union
export function isNodeLoading(state: ActiveNodeState): state is { status: 'loading'; nodeId: string } {
  return state.status === 'loading';
}

interface NodeStoreState {
  nodes: Node[];
  allNodes: Node[];  // All nodes across all repos (for Control Room)
  activeNodeState: ActiveNodeState;  // Atomic state - replaces activeNodeId + activeNode + isNodeLoading
  auditLog: AuditEntry[];
  remoteBranches: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNodes: (repoId: string) => Promise<void>;
  fetchAllNodes: () => Promise<void>;  // Fetch all nodes across all repos
  fetchNode: (id: string) => Promise<void>;
  createNode: (repoId: string, goal: string, parent?: string) => Promise<Node | null>;
  deleteNode: (id: string, force?: boolean) => Promise<boolean>;
  setActiveNode: (id: string | null) => Promise<void>;
  updateDisplayName: (id: string, displayName: string) => Promise<boolean>;

  // New TopBar actions
  fetchRemoteBranches: (repoId: string) => Promise<void>;
  updateParentBranch: (id: string, parentBranch: string) => Promise<boolean>;
  renameNode: (id: string, newDisplayName: string, renameGitBranch?: boolean) => Promise<Node | null>;
  updateNodeContext: (id: string, context: string) => Promise<boolean>;

  // Auto-node creation
  ensureDefaultNode: (repoId: string) => Promise<Node | null>;

  // Manifest actions
  addGroundRule: (nodeId: string, rule: string) => Promise<boolean>;
  updateGoal: (nodeId: string, goal: string) => Promise<boolean>;

  // Audit
  fetchAuditLog: (nodeId: string) => Promise<void>;

  // Update last_active_at locally (called after chat activity)
  updateLastActiveAt: (nodeId: string) => void;
}

// =============================================================================
// SELECTORS - For backward compatibility and clean component access
// =============================================================================

export const selectActiveNodeId = (state: NodeStoreState): string | null => {
  return state.activeNodeState?.status !== 'none' ? state.activeNodeState?.nodeId ?? null : null;
};

export const selectActiveNode = (state: NodeStoreState): NodeWithManifest | null => {
  return state.activeNodeState?.status === 'ready' ? state.activeNodeState.node : null;
};

export const selectIsNodeLoading = (state: NodeStoreState): boolean => {
  return state.activeNodeState?.status === 'loading';
};

// Helper to get last selected node for a repo from localStorage
const getLastSelectedNode = (repoId: string): string | null => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(`caspian_lastNode_${repoId}`);
  }
  return null;
};

// Helper to persist last selected node for a repo
const persistLastSelectedNode = (repoId: string, nodeId: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`caspian_lastNode_${repoId}`, nodeId);
  }
};

// Export for use by other components
export { getLastSelectedNode };

// Mock data for browser development
const createMockNode = (repoId: string, goal: string): Node => ({
  id: `mock-node-${Date.now()}`,
  repo_id: repoId,
  display_name: goal,
  context: null,
  internal_branch: `node-${Date.now()}`,
  parent_branch: 'main',
  original_parent_branch: 'main',
  goal,
  state: 'in_progress',
  worktree_status: 'ready',
  worktree_path: '/mock/worktree',
  checks_completed: 0,
  checks_total: 0,
  manifest_valid: true,
  tests_passed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_active_at: new Date().toISOString(),
});

const mockNodes: Node[] = [];

// Coalesce concurrent node creation / default-node creation per repo to avoid
// duplicate expensive backend worktree checkouts.
const inFlightCreateNodeByRepo = new Map<string, Promise<Node | null>>();
const inFlightEnsureDefaultNodeByRepo = new Map<string, Promise<Node | null>>();

// In-flight node fetches for request deduplication
const inFlightNodeFetches = new Map<string, Promise<void>>();

// AbortController for cancelling in-flight requests when navigating away
let activeNodeAbortController: AbortController | null = null;

export const useNodeStore = create<NodeStoreState>((set, get) => {
  // Helper to refresh node data
  const refreshNode = (nodeId: string) => {
    get().fetchNode(nodeId);
    get().fetchAuditLog(nodeId);
    const state = get();
    const activeNode = selectActiveNode(state);
    if (activeNode?.node.repo_id) {
      get().fetchNodes(activeNode.node.repo_id);
    }
  };

  return {
    nodes: [],
    allNodes: [],  // All nodes across all repos
    activeNodeState: { status: 'none' },  // Atomic state
    auditLog: [],
    remoteBranches: [],
    isLoading: false,
    error: null,

    fetchNodes: async (repoId: string) => {
      set({ isLoading: true, error: null });

      // Browser mode: return mock nodes
      if (!isTauri()) {
        const repoMockNodes = mockNodes.filter(n => n.repo_id === repoId);
        set({ nodes: repoMockNodes, isLoading: false });
        return;
      }

      try {
        const result = await safeInvoke<CommandResult<Node[]>>('list_nodes', { repoId });
        if (result?.success && result?.data) {
          set({ nodes: result?.data, isLoading: false });
        } else {
          const errorMsg = result?.error || 'Failed to fetch nodes';
          set({ error: errorMsg, isLoading: false });
        }
      } catch (err) {
        set({ error: String(err), isLoading: false });
      }
    },

    fetchAllNodes: async () => {
      // Browser mode: return all mock nodes
      if (!isTauri()) {
        set({ allNodes: mockNodes });
        return;
      }

      try {
        const result = await safeInvoke<CommandResult<Node[]>>('list_all_nodes', {});
        if (result?.success && result?.data) {
          set({ allNodes: result.data });
        }
      } catch (err) {
        console.error('Failed to fetch all nodes:', err);
      }
    },

    ensureDefaultNode: async (repoId: string) => {
      const existing = inFlightEnsureDefaultNodeByRepo.get(repoId);
      if (existing) return existing;

      const promise = (async () => {
        // Browser mode: create mock node if none exist
        if (!isTauri()) {
          const repoMockNodes = mockNodes.filter(n => n.repo_id === repoId);
          if (repoMockNodes.length === 0) {
            const newNode = await get().createNode(repoId, 'New node');
            return newNode;
          }
          return repoMockNodes[0];
        }

        // First fetch existing nodes
        try {
          const result = await safeInvoke<CommandResult<Node[]>>('list_nodes', { repoId });
          if (result?.success && result?.data) {
            set({ nodes: result?.data });

            // If no nodes exist, create a default one
            if (result?.data.length === 0) {
              const newNode = await get().createNode(repoId, 'New node');
              return newNode;
            }

            // Return first active node or first node
            const activeNodes = result?.data.filter(n => n.state !== 'closed');
            return activeNodes.length > 0 ? activeNodes[0] : result?.data[0];
          }
        } catch (err) {
          set({ error: String(err) });
        }
        return null;
      })().finally(() => {
        inFlightEnsureDefaultNodeByRepo.delete(repoId);
      });

      inFlightEnsureDefaultNodeByRepo.set(repoId, promise);
      return promise;
    },

    fetchNode: async (id: string) => {
      // Request deduplication: if already fetching this node, return existing promise
      const existingFetch = inFlightNodeFetches.get(id);
      if (existingFetch) {
        return existingFetch;
      }

      set({ activeNodeState: { status: 'loading', nodeId: id }, error: null });

      const fetchPromise = (async () => {
        try {
          const result = await safeInvoke<CommandResult<NodeWithManifest>>('get_node', { id });
          if (result?.success && result?.data) {
            // Cache the fetched node
            setNodeInCache(id, result.data);
            set({ activeNodeState: { status: 'ready', nodeId: id, node: result.data } });
          } else {
            const errorMsg = result?.error || 'Failed to fetch node';
            set({ activeNodeState: { status: 'error', nodeId: id, error: errorMsg } });
          }
        } catch (err) {
          set({ activeNodeState: { status: 'error', nodeId: id, error: String(err) } });
        }
      })();

      inFlightNodeFetches.set(id, fetchPromise);

      try {
        await fetchPromise;
      } finally {
        inFlightNodeFetches.delete(id);
      }
    },

    createNode: async (repoId: string, goal: string, _parent?: string) => {
      const existing = inFlightCreateNodeByRepo.get(repoId);
      if (existing) return existing;

      const promise = (async () => {
        set({ isLoading: true, error: null });

        // Browser mode: create mock node
        if (!isTauri()) {
          const newNode = createMockNode(repoId, goal);
          mockNodes.push(newNode);
          persistLastSelectedNode(repoId, newNode.id);
          // Mock mode: Set node as ready immediately (no async fetch needed)
          const nodeWithManifest: NodeWithManifest = { node: newNode, manifest: null };
          set((state) => ({
            nodes: [newNode, ...state.nodes],
            activeNodeState: { status: 'ready', nodeId: newNode.id, node: nodeWithManifest },
            isLoading: false,
          }));
          return newNode;
        }

        try {
          // Get GitHub username if available
          const { useAuthStore } = await import('./authStore');
          const githubUser = useAuthStore.getState().user;
          const username = githubUser?.login || undefined;

          const result = await safeInvoke<CommandResult<Node>>('create_node', {
            repoId,
            goal,
            parent: _parent,
            username,
          });
          if (result?.success && result?.data) {
            const newNode = result?.data;
            // Persist the new node as last selected for this repo
            persistLastSelectedNode(repoId, newNode.id);
            // Only add to nodes list - setActiveNode() will handle setting active and fetching
            set((state) => ({
              nodes: [newNode, ...state.nodes],
              isLoading: false,
            }));

            return newNode;
          } else {
            const errorMsg = result?.error || 'Failed to create node';
            set({ error: errorMsg, isLoading: false });
            return null;
          }
        } catch (err) {
          set({ error: String(err), isLoading: false });
          return null;
        }
      })().finally(() => {
        inFlightCreateNodeByRepo.delete(repoId);
      });

      inFlightCreateNodeByRepo.set(repoId, promise);
      return promise;
    },

    deleteNode: async (id: string, force = false) => {
      try {
        const state = get();
        const isActiveNode = state.activeNodeState.status !== 'none' && state.activeNodeState.nodeId === id;

        // If deleting the active node, navigate to home FIRST to prevent flash
        // This ensures smooth transition without showing "No active node" fallback
        if (isActiveNode) {
          useUIStore.getState().setViewMode('home');
        }

        const result = await safeInvoke<CommandResult<void>>('delete_node', { id, force });
        if (result?.success) {
          // Invalidate cache for deleted node
          invalidateNode(id);

          set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== id),
            activeNodeState:
              state.activeNodeState.status !== 'none' && state.activeNodeState.nodeId === id
                ? { status: 'none' }
                : state.activeNodeState,
          }));

          return true;
        } else {
          const errorMsg = result?.error || 'Failed to delete node';
          set({ error: errorMsg });
          return false;
        }
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    setActiveNode: async (id: string | null) => {
      // Cancel any in-flight request when switching nodes
      if (activeNodeAbortController) {
        activeNodeAbortController.abort();
        activeNodeAbortController = null;
      }

      if (id === null) {
        set({ activeNodeState: { status: 'none' }, auditLog: [] });
        return;
      }

      // Persist last selected node for repo
      const node = get().nodes.find(n => n.id === id);
      if (node?.repo_id) {
        persistLastSelectedNode(node.repo_id, id);
      }

      // Create new abort controller for this request
      activeNodeAbortController = new AbortController();
      const currentAbortController = activeNodeAbortController;

      // Stale-while-revalidate: show cached data immediately, revalidate in background if stale
      const cached = getNodeFromCache(id);

      if (cached.status === 'fresh') {
        // Cache hit (fresh) - show immediately, no fetch needed
        set({ activeNodeState: { status: 'ready', nodeId: id, node: cached.data! } });
        get().fetchAuditLog(id);
        return;
      }

      if (cached.status === 'stale') {
        // Cache hit (stale) - show immediately, revalidate in background
        set({ activeNodeState: { status: 'ready', nodeId: id, node: cached.data! } });

        // Background revalidation (non-blocking)
        (async () => {
          try {
            // Check if aborted before making the request
            if (currentAbortController.signal.aborted) {
              return;
            }

            const result = await safeInvoke<CommandResult<NodeWithManifest>>('get_node', { id });

            // Check if aborted after the request
            if (currentAbortController.signal.aborted) {
              return;
            }

            if (result?.success && result?.data) {
              setNodeInCache(id, result.data);
              // Only update UI if still viewing this node
              const currentState = get().activeNodeState;
              if (currentState.status !== 'none' && currentState.nodeId === id) {
                set({ activeNodeState: { status: 'ready', nodeId: id, node: result.data } });
              }
            }
          } catch {
            // Silent fail for background revalidation
          }
        })();

        get().fetchAuditLog(id);
        return;
      }

      // Cache miss - show loading state and fetch
      set({ activeNodeState: { status: 'loading', nodeId: id } });
      get().fetchNode(id);
      get().fetchAuditLog(id);
    },

    updateDisplayName: async (id: string, displayName: string) => {
      try {
        const result = await safeInvoke<CommandResult<void>>('update_node_display_name', {
          id,
          displayName,
        });
        if (result?.success) {
          // Invalidate cache to ensure fresh data on next access
          invalidateNode(id);
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? { ...n, display_name: displayName } : n
            ),
            activeNodeState:
              state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === id
                ? {
                    ...state.activeNodeState,
                    node: {
                      ...state.activeNodeState.node,
                      node: { ...state.activeNodeState.node.node, display_name: displayName }
                    }
                  }
                : state.activeNodeState,
          }));
          return true;
        }
        return false;
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    fetchRemoteBranches: async (repoId: string) => {
      try {
        const result = await safeInvoke<CommandResult<string[]>>('list_remote_branches', { repoId });
        if (result?.success && result?.data) {
          set({ remoteBranches: result?.data });
        }
      } catch (err) {
        console.warn('Failed to fetch remote branches:', err);
      }
    },

    updateParentBranch: async (id: string, parentBranch: string) => {
      try {
        const result = await safeInvoke<CommandResult<void>>('update_node_parent_branch', {
          id,
          parentBranch,
        });
        if (result?.success) {
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? { ...n, parent_branch: parentBranch } : n
            ),
            activeNodeState:
              state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === id
                ? {
                    ...state.activeNodeState,
                    node: {
                      ...state.activeNodeState.node,
                      node: { ...state.activeNodeState.node.node, parent_branch: parentBranch }
                    }
                  }
                : state.activeNodeState,
          }));
          return true;
        }
        return false;
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    renameNode: async (id: string, newDisplayName: string, renameGitBranch = false) => {
      try {
        const result = await safeInvoke<CommandResult<Node>>('rename_node', {
          id,
          newDisplayName,
          renameGitBranch,
        });
        if (result?.success && result?.data) {
          // Invalidate cache to ensure fresh data on next access
          invalidateNode(id);
          const updatedNode = result?.data;
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? updatedNode : n
            ),
            activeNodeState:
              state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === id
                ? { ...state.activeNodeState, node: { ...state.activeNodeState.node, node: updatedNode } }
                : state.activeNodeState,
          }));

          return updatedNode;
        }
        return null;
      } catch (err) {
        set({ error: String(err) });
        return null;
      }
    },

    updateNodeContext: async (id: string, context: string) => {
      try {
        const result = await safeInvoke<CommandResult<void>>('update_node_context', {
          id,
          context,
        });
        if (result?.success) {
          // Invalidate cache to ensure fresh data on next access
          invalidateNode(id);
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? { ...n, context } : n
            ),
            activeNodeState:
              state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === id
                ? {
                    ...state.activeNodeState,
                    node: {
                      ...state.activeNodeState.node,
                      node: { ...state.activeNodeState.node.node, context }
                    }
                  }
                : state.activeNodeState,
          }));
          return true;
        }
        return false;
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    addGroundRule: async (nodeId: string, rule: string) => {
      try {
        const result = await safeInvoke<CommandResult<NodeManifest>>('add_ground_rule', {
          nodeId,
          rule,
        });
        if (result?.success && result?.data) {
          set((state) => ({
            activeNodeState:
              state.activeNodeState.status === 'ready'
                ? { ...state.activeNodeState, node: { ...state.activeNodeState.node, manifest: result.data } }
                : state.activeNodeState,
          }));

          return true;
        }
        return false;
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    updateGoal: async (nodeId: string, goal: string) => {
      try {
        const result = await safeInvoke<CommandResult<NodeManifest>>('update_goal', {
          nodeId,
          goal,
        });
        if (result?.success && result?.data) {
          // Invalidate cache to ensure fresh data on next access
          invalidateNode(nodeId);
          set((state) => ({
            activeNodeState:
              state.activeNodeState.status === 'ready'
                ? { ...state.activeNodeState, node: { ...state.activeNodeState.node, manifest: result.data } }
                : state.activeNodeState,
          }));

          refreshNode(nodeId);
          return true;
        }
        return false;
      } catch (err) {
        set({ error: String(err) });
        return false;
      }
    },

    fetchAuditLog: async (nodeId: string) => {
      // Check cache first
      const cached = getAuditFromCache(nodeId);
      if (cached.status === 'fresh') {
        set({ auditLog: cached.data! });
        return;
      }

      // Show stale data immediately if available
      if (cached.status === 'stale') {
        set({ auditLog: cached.data! });
      }

      // Fetch fresh data
      try {
        const result = await safeInvoke<CommandResult<AuditEntry[]>>('get_audit_log', { nodeId });
        if (result?.success && result?.data) {
          setAuditInCache(nodeId, result.data);
          set({ auditLog: result.data });
        }
      } catch {
        // Silent fail for audit log
      }
    },

    updateLastActiveAt: (nodeId: string) => {
      const now = new Date().toISOString();
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, last_active_at: now } : n
        ),
        activeNodeState:
          state.activeNodeState.status === 'ready' && state.activeNodeState.nodeId === nodeId
            ? {
                ...state.activeNodeState,
                node: {
                  ...state.activeNodeState.node,
                  node: { ...state.activeNodeState.node.node, last_active_at: now }
                }
              }
            : state.activeNodeState,
      }));
    },
  };
});
