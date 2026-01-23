import { memo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAgentStore } from '../../stores/agentStore';
import { useWorktreeStore } from '../../stores/worktreeStore';
import { prefetchNodeOnHover } from '../../utils/nodeDataCoordinator';
import { NodeStatus, type NodeStatusType } from './NodeStatus';
import type { Node } from '../../types';

// Debounce delay for prefetch on hover
const PREFETCH_HOVER_DELAY_MS = 150;

interface NodeItemProps {
  node: Node;
  depth: number;
  isSelected: boolean;
  isMenuOpen: boolean;
  menuPosition: { top: number; left: number } | null;
  onNodeClick: (node: Node) => void;
  onMenuToggle: (nodeId: string | null, position: { top: number; left: number } | null) => void;
  onDeleteRequest: (node: Node) => void;
}

/**
 * NodeItem - Memoized node row component
 *
 * Isolates subscriptions to agentStore and worktreeStore for a single node.
 * Only re-renders when its specific node's status changes.
 */
export const NodeItem = memo(function NodeItem({
  node,
  depth,
  isSelected,
  isMenuOpen,
  menuPosition,
  onNodeClick,
  onMenuToggle,
  onDeleteRequest,
}: NodeItemProps) {
  // Subscribe only to this node's status (granular subscription)
  const nodeSession = useAgentStore(state => state.nodeStatus[node.id]);
  const worktreeOp = useWorktreeStore(state => state.operations[node.id]);
  const retryWorktreeCreation = useWorktreeStore(state => state.retryWorktreeCreation);

  // Ref for prefetch debounce timer
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute display status
  const getNodeStatusDisplay = useCallback((): NodeStatusType => {
    // Check worktree status first
    const worktreeStatus = node.worktree_status;
    if (worktreeStatus === 'pending' || worktreeStatus === 'creating') {
      return 'preparing';
    }
    if (worktreeStatus === 'failed') {
      return 'worktree_failed';
    }

    // Then check agent status
    if (!nodeSession) return 'idle';

    switch (nodeSession.status) {
      case 'running': return 'running';
      case 'completed': return 'completed';
      case 'failed': return 'error';
      case 'pending': return 'pending';
      default: return 'idle';
    }
  }, [node.worktree_status, nodeSession]);

  const status = getNodeStatusDisplay();
  const isWorktreeNotReady = node.worktree_status !== 'ready';

  const handleClick = useCallback(() => {
    onNodeClick(node);
  }, [node, onNodeClick]);

  const handleMenuClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isMenuOpen) {
      onMenuToggle(null, null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      onMenuToggle(node.id, { top: rect.bottom + 4, left: rect.right - 120 });
    }
  }, [isMenuOpen, node.id, onMenuToggle]);

  const handleRetry = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(null, null);
    await retryWorktreeCreation(node.id);
  }, [node.id, onMenuToggle, retryWorktreeCreation]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(null, null);
    onDeleteRequest(node);
  }, [node, onMenuToggle, onDeleteRequest]);

  // Prefetch node data AND messages on hover (debounced)
  const handleMouseEnter = useCallback(() => {
    // Don't prefetch if already selected or worktree not ready
    if (isSelected || node.worktree_status !== 'ready') return;

    prefetchTimerRef.current = setTimeout(() => {
      // Pass repoId so messages can also be prefetched
      prefetchNodeOnHover(node.id, node.repo_id);
    }, PREFETCH_HOVER_DELAY_MS);
  }, [isSelected, node.id, node.repo_id, node.worktree_status]);

  const handleMouseLeave = useCallback(() => {
    // Cancel pending prefetch if user leaves before debounce
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative group rounded-[10px] transition-all ${
        isSelected
          ? 'bg-white/[0.04] border border-white/[0.05]'
          : 'hover:bg-white/[0.03] border border-transparent'
      } ${isWorktreeNotReady ? 'opacity-60' : ''}`}
    >
      <button
        onClick={handleClick}
        className="w-full text-left py-2.5 px-2.5"
        style={{ paddingLeft: depth > 0 ? `${10 + depth * 10}px` : '10px' }}
        disabled={node.worktree_status === 'failed'}
      >
        {/* Primary: node title */}
        <div className={`text-[13px] font-medium truncate ${isSelected ? 'text-white/[0.92]' : 'text-white/[0.75]'}`}>
          {node.context || node.display_name}
        </div>
        {/* Secondary: branch name + original parent */}
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          <span className="text-[12px] text-white/[0.45] truncate font-mono">
            {node.internal_branch}
          </span>
          {node.original_parent_branch && (
            <span className="text-[10px] text-white/[0.35] flex-shrink-0">
              from {node.original_parent_branch.replace(/^origin\//, '')}
            </span>
          )}
        </div>
        {/* Status badge when not idle */}
        {status !== 'idle' && (
          <div className="mt-1.5">
            <NodeStatus
              status={status}
              worktreeProgress={worktreeOp ? {
                progress: worktreeOp.progress,
                attempt: worktreeOp.attempt,
                maxAttempts: worktreeOp.maxAttempts,
              } : undefined}
            />
          </div>
        )}
      </button>

      {/* 3-dot menu button */}
      <button
        onClick={handleMenuClick}
        className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-opacity"
      >
        <svg className="w-3.5 h-3.5 text-white/[0.7]" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && menuPosition && createPortal(
        <div
          className="fixed z-50 glass-popover border border-white/[0.08] rounded-xl py-1 min-w-[120px]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {node.worktree_status === 'failed' && (
            <button
              onClick={handleRetry}
              className="w-full px-3 py-1.5 text-left text-[12px] text-interactive hover:bg-white/[0.04] transition-colors"
            >
              Retry setup
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 text-left text-[12px] text-error hover:bg-white/[0.04] transition-colors"
          >
            Delete node
          </button>
        </div>,
        document.body
      )}
    </div>
  );
});
