import { memo, useState, useCallback } from 'react';
import { NodeList } from './NodeList';
import { useUIStore } from '../../stores/uiStore';
import type { Node } from '../../types';
import type { Repository } from '../../types';

// Tree node structure for hierarchical display
interface TreeNode {
  node: Node;
  children: TreeNode[];
  depth: number;
}

interface RepoSectionProps {
  repo: Repository;
  treeNodes: TreeNode[];
  closedNodes: Node[];
  activeNodeId: string | null;
  isWorkspace: boolean;
  isFirst: boolean;
  isCreating: boolean;
  onCreateNode: (repoId: string) => void;
  onNodeClick: (node: Node) => void;
  onDeleteRequest: (node: Node) => void;
}

/**
 * RepoSection - Memoized repository section with expand/collapse
 *
 * Handles its own expansion state locally.
 * Only re-renders when repo or nodes change.
 */
export const RepoSection = memo(function RepoSection({
  repo,
  treeNodes,
  closedNodes,
  activeNodeId,
  isWorkspace,
  isFirst,
  isCreating,
  onCreateNode,
  onNodeClick,
  onDeleteRequest,
}: RepoSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuOpenForNode, setMenuOpenForNode] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const { setMissingRepoDialog } = useUIStore();

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleCreateNode = useCallback(() => {
    onCreateNode(repo.id);
  }, [repo.id, onCreateNode]);

  const handleMenuToggle = useCallback((nodeId: string | null, position: { top: number; left: number } | null) => {
    setMenuOpenForNode(nodeId);
    setMenuPosition(position);
  }, []);

  const handleMissingRepoClick = useCallback(() => {
    setMissingRepoDialog(true, repo.id);
  }, [repo.id, setMissingRepoDialog]);

  return (
    <div>
      {/* Divider between repos */}
      {!isFirst && (
        <div className="py-3">
          <div className="h-px bg-white/[0.10]" />
        </div>
      )}

      {/* Section label */}
      {isFirst && (
        <div className="text-[11px] font-semibold text-white/[0.40] uppercase tracking-[0.06em] mb-2 px-2.5">
          Repository
        </div>
      )}

      {/* Repo selector */}
      <button
        onClick={toggleExpanded}
        className="w-full h-[30px] flex items-center gap-2 px-2.5 rounded-lg bg-white/[0.025] border border-white/[0.05] hover:bg-white/[0.04] text-left transition-colors group"
      >
        <span className={`text-[12px] font-semibold truncate flex-1 ${!repo.path_exists ? 'text-text-tertiary' : 'text-white/[0.85]'}`}>
          {repo.name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-white/[0.55] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* New node button */}
          <button
            onClick={handleCreateNode}
            disabled={isCreating || !repo.path_exists}
            className="h-8 mt-2 px-3 flex items-center gap-2 text-[12px] font-medium text-white/[0.80] bg-white/[0.04] border border-white/[0.06] hover:text-white hover:bg-white/[0.08] hover:border-white/[0.10] rounded-lg transition-all disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-white/[0.65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isCreating ? 'Creating...' : 'New node'}
          </button>

          {/* Node list */}
          <NodeList
            treeNodes={treeNodes}
            closedNodes={closedNodes}
            activeNodeId={activeNodeId}
            isWorkspace={isWorkspace}
            menuOpenForNode={menuOpenForNode}
            menuPosition={menuPosition}
            onNodeClick={onNodeClick}
            onMenuToggle={handleMenuToggle}
            onDeleteRequest={onDeleteRequest}
          />
        </>
      )}

      {/* Missing repo warning */}
      {!repo.path_exists && (
        <button
          onClick={handleMissingRepoClick}
          className="py-1 text-caption text-warning hover:text-warning/80 hover:underline cursor-pointer transition-colors"
        >
          Folder not found
        </button>
      )}

      {/* Click outside to close menu */}
      {menuOpenForNode && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => handleMenuToggle(null, null)}
        />
      )}
    </div>
  );
});
