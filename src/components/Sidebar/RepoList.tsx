import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore, selectActiveNodeId } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';
import { useWorktreeStore } from '../../stores/worktreeStore';
import { RepoSection } from './RepoSection';
import { BranchSelectionDialog } from '../Modals/BranchSelectionDialog';
import { safeListen } from '../../utils/tauri';
import type { Node, WorktreeProgressEvent } from '../../types';

// Tree node structure for hierarchical display
interface TreeNode {
  node: Node;
  children: TreeNode[];
  depth: number;
}

// Build a tree structure from flat nodes based on parent_branch
function buildNodeTree(nodes: Node[]): TreeNode[] {
  const branchToNode = new Map<string, Node>();
  nodes.forEach(n => branchToNode.set(n.internal_branch, n));

  const nodeInternalBranches = new Set(nodes.map(n => n.internal_branch));
  const childrenMap = new Map<string, Node[]>();
  const rootNodes: Node[] = [];

  nodes.forEach(node => {
    if (nodeInternalBranches.has(node.parent_branch)) {
      const children = childrenMap.get(node.parent_branch) || [];
      children.push(node);
      childrenMap.set(node.parent_branch, children);
    } else {
      rootNodes.push(node);
    }
  });

  function buildSubtree(node: Node, depth: number): TreeNode {
    const children = childrenMap.get(node.internal_branch) || [];
    return {
      node,
      depth,
      children: children.map(child => buildSubtree(child, depth + 1)),
    };
  }

  rootNodes.sort((a, b) => {
    if (a.parent_branch !== b.parent_branch) {
      const aIsMain = a.parent_branch === 'main' || a.parent_branch === 'master';
      const bIsMain = b.parent_branch === 'main' || b.parent_branch === 'master';
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return a.parent_branch.localeCompare(b.parent_branch);
    }
    return 0;
  });

  return rootNodes.map(node => buildSubtree(node, 0));
}

function flattenTree(trees: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function traverse(tree: TreeNode) {
    result.push(tree);
    tree.children.forEach(traverse);
  }
  trees.forEach(traverse);
  return result;
}

// Helper to wait for a node's worktree to be ready
// Returns the final status ('ready' or 'failed') or null on timeout
async function waitForWorktreeReady(
  nodeId: string,
  timeoutMs: number = 60000
): Promise<'ready' | 'failed' | null> {
  return new Promise(async (resolve) => {
    let unlisten: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (unlisten) unlisten();
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    // Listen for worktree progress events
    unlisten = await safeListen<WorktreeProgressEvent>(
      'worktree:progress',
      (payload) => {
        if (payload.node_id === nodeId) {
          if (payload.status === 'ready' || payload.status === 'failed') {
            cleanup();
            resolve(payload.status);
          }
        }
      }
    );

    // Check if already ready (in case event fired before we subscribed)
    const nodeStore = useNodeStore.getState();
    const node = nodeStore.nodes.find(n => n.id === nodeId);
    if (node?.worktree_status === 'ready') {
      cleanup();
      resolve('ready');
    } else if (node?.worktree_status === 'failed') {
      cleanup();
      resolve('failed');
    }
  });
}

interface RepoListProps {
  isWorkspace: boolean;
  onNodeClick: (node: Node) => void;
}

/**
 * RepoList - Manages repository list and node data
 *
 * Subscribes to stores with granular selectors to minimize re-renders.
 * Delegates rendering of individual repos to memoized RepoSection components.
 */
export const RepoList = memo(function RepoList({ isWorkspace, onNodeClick }: RepoListProps) {
  // Granular store subscriptions - use useShallow for array/object selectors
  const repositories = useRepositoryStore(useShallow(state => state.repositories));
  const nodes = useNodeStore(useShallow(state => state.nodes));
  const activeNodeId = useNodeStore(selectActiveNodeId);
  // Use individual selectors for actions to avoid subscribing to entire store
  const createNode = useNodeStore(state => state.createNode);
  const fetchNodes = useNodeStore(state => state.fetchNodes);
  const deleteNode = useNodeStore(state => state.deleteNode);
  const nodeStatus = useAgentStore(useShallow(state => state.nodeStatus));
  const getAgentStatusesBatch = useAgentStore(state => state.getAgentStatusesBatch);
  const subscribeToWorktreeEvents = useWorktreeStore(state => state.subscribeToWorktreeEvents);

  // Local state
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [repoNodes, setRepoNodes] = useState<Record<string, Node[]>>({});
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<Node | null>(null);
  const [branchDialogRepoId, setBranchDialogRepoId] = useState<string | null>(null);

  // Subscribe to worktree events on mount
  useEffect(() => {
    subscribeToWorktreeEvents();
  }, [subscribeToWorktreeEvents]);

  // Load nodes for all repos on mount
  useEffect(() => {
    const loadAllNodes = async () => {
      for (const repo of repositories) {
        if (!repoNodes[repo.id]) {
          await fetchNodes(repo.id);
        }
      }
    };
    loadAllNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  // Memoize nodesKey to avoid expensive computation on every render
  const nodesKey = useMemo(() =>
    nodes.map(n => `${n.id}:${n.display_name}:${n.worktree_status}`).join(','),
    [nodes]
  );

  // Update repoNodes when nodes change
  useEffect(() => {
    if (nodes.length === 0) return;
    const repoId = nodes[0]?.repo_id;
    if (!repoId) return;

    setRepoNodes(prev => ({
      ...prev,
      [repoId]: nodes.filter(n => n.repo_id === repoId)
    }));
  }, [nodes, nodesKey]);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Fetch status for visible nodes (batch query)
  useEffect(() => {
    const visibleNodeIds = Object.values(repoNodes).flat().map(n => n.id);
    if (visibleNodeIds.length === 0) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      const timer = setTimeout(() => {
        getAgentStatusesBatch(visibleNodeIds);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      const nodeIdsToFetch = visibleNodeIds.filter(nodeId => nodeStatus[nodeId] === undefined);
      if (nodeIdsToFetch.length > 0) {
        getAgentStatusesBatch(nodeIdsToFetch);
      }
    }
  }, [repoNodes, nodeStatus, getAgentStatusesBatch]);

  // Memoized tree-structured nodes per repo
  const treeRepoNodes = useMemo(() => {
    const trees: Record<string, TreeNode[]> = {};
    for (const repoId of Object.keys(repoNodes)) {
      const nodes = repoNodes[repoId] || [];
      const activeNodes = nodes.filter(n => n.state !== 'closed');
      const tree = buildNodeTree(activeNodes);
      trees[repoId] = flattenTree(tree);
    }
    return trees;
  }, [repoNodes]);

  // Handlers
  const handleCreateNode = useCallback((repoId: string) => {
    if (isCreating) return;
    setBranchDialogRepoId(repoId);
  }, [isCreating]);

  const handleBranchSelected = useCallback(async (parentBranch: string) => {
    if (!branchDialogRepoId || isCreating) return;
    const repoId = branchDialogRepoId;
    setBranchDialogRepoId(null);
    setIsCreating(repoId);
    try {
      const newNode = await createNode(repoId, 'New node', parentBranch);
      if (newNode) {
        await fetchNodes(repoId);

        // Wait for worktree to be ready before navigating
        // This prevents showing a "not ready" state to the user
        if (newNode.worktree_status === 'ready') {
          // Already ready (rare but possible)
          onNodeClick(newNode);
        } else {
          // Wait for worktree creation to complete
          const status = await waitForWorktreeReady(newNode.id, 60000);

          if (status === 'ready') {
            // Refetch the node to get updated worktree_path
            await fetchNodes(repoId);
            const updatedNode = useNodeStore.getState().nodes.find(n => n.id === newNode.id);
            onNodeClick(updatedNode || newNode);
          } else if (status === 'failed') {
            useUIStore.getState().setErrorMessage('Failed to create worktree. You can retry from the node.');
            // Still navigate so user can see the failed state and retry
            onNodeClick(newNode);
          } else {
            // Timeout - navigate anyway, user will see "preparing" state
            useUIStore.getState().setErrorMessage('Worktree creation is taking longer than expected.');
            onNodeClick(newNode);
          }
        }
      } else {
        const { error } = useNodeStore.getState();
        if (error) {
          useUIStore.getState().setErrorMessage(error);
        }
      }
    } catch (err) {
      useUIStore.getState().setErrorMessage(String(err));
    } finally {
      setIsCreating(null);
    }
  }, [branchDialogRepoId, isCreating, createNode, fetchNodes, onNodeClick]);

  const handleDeleteRequest = useCallback((node: Node) => {
    setDeleteConfirmNode(node);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmNode) return;
    const nodeToDelete = deleteConfirmNode;
    setDeleteConfirmNode(null);
    const success = await deleteNode(nodeToDelete.id, true);
    if (success) {
      setRepoNodes(prev => ({
        ...prev,
        [nodeToDelete.repo_id]: (prev[nodeToDelete.repo_id] || []).filter(n => n.id !== nodeToDelete.id)
      }));
    }
  }, [deleteConfirmNode, deleteNode]);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3">
        {repositories.map((repo, index) => {
          const nodes = repoNodes[repo.id] || [];
          const treeNodes = treeRepoNodes[repo.id] || [];
          const closedNodes = nodes.filter(n => n.state === 'closed');

          return (
            <RepoSection
              key={repo.id}
              repo={repo}
              treeNodes={treeNodes}
              closedNodes={closedNodes}
              activeNodeId={activeNodeId}
              isWorkspace={isWorkspace}
              isFirst={index === 0}
              isCreating={isCreating === repo.id}
              onCreateNode={handleCreateNode}
              onNodeClick={onNodeClick}
              onDeleteRequest={handleDeleteRequest}
            />
          );
        })}

        {/* Empty state */}
        {repositories.length === 0 && (
          <div className="px-3 py-6 text-[12px] text-white/[0.40] text-center">
            Add your first repository to get started.
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="glass-popover border border-white/[0.08] rounded-xl p-4 max-w-sm mx-4"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <h3 className="text-body font-semibold text-text-primary mb-2">Delete Node</h3>
            <p className="text-caption text-text-secondary mb-4">
              Are you sure you want to delete "{deleteConfirmNode.display_name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmNode(null)}
                className="px-3 py-1.5 text-caption text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-caption bg-error text-white rounded hover:bg-error/80 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch selection dialog */}
      {branchDialogRepoId && (
        <BranchSelectionDialog
          isOpen={!!branchDialogRepoId}
          onClose={() => setBranchDialogRepoId(null)}
          repoId={branchDialogRepoId}
          onBranchSelected={handleBranchSelected}
        />
      )}
    </>
  );
});
