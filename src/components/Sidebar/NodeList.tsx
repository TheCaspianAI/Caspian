import { memo, useCallback } from 'react';
import { NodeItem } from './NodeItem';
import type { Node } from '../../types';

// Tree node structure for hierarchical display
interface TreeNode {
  node: Node;
  children: TreeNode[];
  depth: number;
}

interface NodeListProps {
  treeNodes: TreeNode[];
  closedNodes: Node[];
  activeNodeId: string | null;
  isWorkspace: boolean;
  menuOpenForNode: string | null;
  menuPosition: { top: number; left: number } | null;
  onNodeClick: (node: Node) => void;
  onMenuToggle: (nodeId: string | null, position: { top: number; left: number } | null) => void;
  onDeleteRequest: (node: Node) => void;
}

/**
 * NodeList - Memoized list of nodes for a repository
 *
 * Only re-renders when nodes array or selection changes.
 * Individual NodeItems handle their own status subscriptions.
 */
export const NodeList = memo(function NodeList({
  treeNodes,
  closedNodes,
  activeNodeId,
  isWorkspace,
  menuOpenForNode,
  menuPosition,
  onNodeClick,
  onMenuToggle,
  onDeleteRequest,
}: NodeListProps) {
  const handleNodeClick = useCallback((node: Node) => {
    onNodeClick(node);
  }, [onNodeClick]);

  return (
    <>
      {/* Section label */}
      {treeNodes.length > 0 && (
        <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/[0.40] mt-3 mb-2 px-2.5">
          Nodes
        </div>
      )}

      {/* Active nodes */}
      <div className="space-y-1">
        {treeNodes.map((treeNode) => {
          const node = treeNode.node;
          const isSelected = activeNodeId === node.id && isWorkspace;

          return (
            <NodeItem
              key={node.id}
              node={node}
              depth={treeNode.depth}
              isSelected={isSelected}
              isMenuOpen={menuOpenForNode === node.id}
              menuPosition={menuOpenForNode === node.id ? menuPosition : null}
              onNodeClick={handleNodeClick}
              onMenuToggle={onMenuToggle}
              onDeleteRequest={onDeleteRequest}
            />
          );
        })}
      </div>

      {/* Closed nodes */}
      {closedNodes.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-white/[0.55] mb-2 px-3">
            Closed
          </div>
          {closedNodes.map((node) => {
            const isSelected = activeNodeId === node.id && isWorkspace;

            return (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`w-full text-left px-3 py-2 rounded-[10px] transition-colors opacity-50 ${
                  isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="text-[12px] font-medium text-text-tertiary truncate">
                  {node.context || node.display_name}
                </div>
                <div className="text-[11px] text-white/[0.5] truncate mt-0.5">
                  {node.internal_branch}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
});
