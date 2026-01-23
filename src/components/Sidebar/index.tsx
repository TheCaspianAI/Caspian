import { memo, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useViewRouter } from '../../hooks/useViewRouter';
import { NavButtons } from './NavButtons';
import { RepoList } from './RepoList';
import { AddRepoPopover } from './AddRepoPopover';
import type { Node } from '../../types';

interface SidebarProps {
  width: number;
}

/**
 * Sidebar - Main sidebar component
 *
 * Minimal subscriptions at this level. Most logic is delegated to
 * memoized sub-components (NavButtons, RepoList, AddRepoPopover).
 *
 * Only subscribes to:
 * - focusMode (for collapsed state)
 * - isWorkspace + navigateToNode (for navigation)
 */
export const Sidebar = memo(function Sidebar({ width }: SidebarProps) {
  const focusMode = useUIStore(state => state.focusMode);
  const toggleFocusMode = useUIStore(state => state.toggleFocusMode);
  const { isWorkspace, navigateToNode } = useViewRouter();

  const handleNodeClick = useCallback((node: Node) => {
    navigateToNode(node.id, node.repo_id);
  }, [navigateToNode]);

  // Focus mode: minimal sidebar
  if (focusMode) {
    return (
      <div className="h-full glass-sidebar flex flex-col items-center py-4 w-[60px] 2xl:w-[70px] 3xl:w-[80px]">
        <button
          onClick={toggleFocusMode}
          className="p-2 rounded-lg hover:bg-surface-hover text-interactive"
          title="Exit Focus Mode (Cmd+F)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div
      className="h-full glass-sidebar flex flex-col"
      style={{ width }}
    >
      {/* Primary navigation */}
      <NavButtons />

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4 mt-3.5 mb-3.5" />

      {/* Repository list with nodes */}
      <RepoList
        isWorkspace={isWorkspace}
        onNodeClick={handleNodeClick}
      />

      {/* Footer with Add Repository button */}
      <AddRepoPopover />
    </div>
  );
});

// Re-export for compatibility
export { Sidebar as default };
