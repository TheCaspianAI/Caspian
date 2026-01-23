import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGridStore } from '../../stores/gridStore';
import { useNodeStore } from '../../stores/nodeStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { useGridNavigation } from '../../hooks/useGridNavigation';
import { useNodeCardDataBatch } from '../../hooks/useNodeCardData';
import type { GridItem, GridCardStatus, Node } from '../../types';

import { NodeCard } from './NodeCard';
import { NumberInputModal } from './NumberInputModal';
import { useGridAudio } from './useGridAudio';
import { BranchSelectionDialog } from '../Modals/BranchSelectionDialog';

interface GridViewProps {
  onClose: () => void;
}

export function GridView({ onClose }: GridViewProps) {
  const { repositories } = useRepositoryStore();
  const { nodes, createNode, setActiveNode } = useNodeStore();
  // Use shallow comparison to only re-render when nodeStatus entries actually change
  const nodeStatus = useAgentStore(useShallow(state => state.nodeStatus));
  const { setGridViewOpen, setActiveTabId } = useUIStore();
  const { playNavigateSound, playSelectSound } = useGridAudio(true);
  const prevSelectedIndexRef = useRef<number | null>(null);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    currentPage,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
    showNumberInput,
    setShowNumberInput,
    selectedIndex,
    selectedIndices,
    clearSelection,
    setSelectedIndex,
  } = useGridStore();

  // Convert node execution status to grid card status
  const getCardStatus = useCallback((node: Node): GridCardStatus => {
    const session = nodeStatus[node.id];
    if (session?.status === 'running') return 'thinking';
    if (session?.status === 'completed') return 'completed';
    if (session?.status === 'pending') return 'needs_input';
    if (session?.status === 'failed') return 'failed';
    return 'idle';
  }, [nodeStatus]);

  // Status priority for sorting
  const statusPriority: Record<GridCardStatus, number> = {
    failed: 0,
    needs_input: 1,
    completed: 2,
    thinking: 3,
    idle: 4,
  };

  // Get card data for all nodes
  const nodeCardDataMap = useNodeCardDataBatch(nodes, { refreshInterval: 10000 });

  // Build grid items
  const gridItems = useMemo((): GridItem[] => {
    const items = nodes.map(node => {
      const repo = repositories.find(r => r.id === node.repo_id);
      return {
        type: 'node' as const,
        id: node.id,
        name: node.display_name || node.internal_branch,
        node,
        agentType: 'claude_code' as const,
        status: getCardStatus(node),
        intent: node.goal || undefined,
        scope: [],
        lastActive: node.last_active_at,
        path: repo?.name,
      };
    });
    return items.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
  }, [repositories, nodes, getCardStatus, nodeStatus]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return gridItems;
    const query = searchQuery.toLowerCase();
    return gridItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      (item.intent?.toLowerCase().includes(query)) ||
      (item.path?.toLowerCase().includes(query))
    );
  }, [gridItems, searchQuery]);

  // Pagination
  const pageSize = 12;
  const totalCards = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / pageSize));
  const startIndex = currentPage * pageSize;
  const pageItems = filteredItems.slice(startIndex, startIndex + pageSize);

  // Play navigate sound when selection changes
  useEffect(() => {
    if (prevSelectedIndexRef.current !== null && selectedIndex !== prevSelectedIndexRef.current) {
      playNavigateSound();
    }
    prevSelectedIndexRef.current = selectedIndex;
  }, [selectedIndex, playNavigateSound]);

  // Focus search on "/" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          setSearchQuery('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, setSearchQuery]);

  // Handle opening a card
  const handleOpen = useCallback((index: number) => {
    playSelectSound();
    const item = filteredItems[index];
    if (item?.node) {
      setActiveNode(item.node.id);
      setActiveTabId(item.node.id, 'chat');
      setGridViewOpen(false);
    }
  }, [filteredItems, setActiveNode, setActiveTabId, setGridViewOpen, playSelectSound]);

  // Handle delete
  const handleDelete = useCallback((_indices: number[]) => {
    // TODO: Implement node deletion
    clearSelection();
  }, [clearSelection]);

  // Navigation hook
  const { handleRangeSelect, handleToggleSelect } = useGridNavigation({
    totalItems: totalCards,
    rows: Math.ceil(pageItems.length / 4),
    cols: Math.min(4, pageItems.length),
    onOpen: handleOpen,
    onClose,
    onDelete: handleDelete,
    enabled: !showNumberInput,
  });

  // Create node
  const handleCreateNode = useCallback(() => {
    if (repositories.length > 0) {
      setBranchDialogOpen(true);
    }
  }, [repositories]);

  const handleBranchSelected = useCallback(async (parentBranch: string) => {
    const repo = repositories[0];
    if (repo) {
      await createNode(repo.id, 'New node', parentBranch);
    }
    setBranchDialogOpen(false);
  }, [repositories, createNode]);

  // Handle number input submission
  const handleNumberSubmit = useCallback((value: string) => {
    const cardNum = parseInt(value, 10) - 1;
    if (!isNaN(cardNum) && cardNum >= 0 && cardNum < totalCards) {
      setSelectedIndex(cardNum);
    }
  }, [totalCards, setSelectedIndex]);

  // Handle multi-select click
  const handleCardMultiSelect = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      handleRangeSelect(index, true);
    } else if (e.metaKey || e.ctrlKey) {
      handleToggleSelect(index);
    }
  }, [handleRangeSelect, handleToggleSelect]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col">
      {/* App background */}
      <div className="app-background" />
      <div className="app-vignette" />
      <div className="noise-overlay" />

      {/* Title bar - drag region */}
      <div className="title-bar" data-tauri-drag-region />

      {/* Main content - centered column layout matching Home */}
      <div className="flex-1 flex flex-col items-center px-6 py-8 overflow-auto">
        {/* Header section */}
        <div className="w-full max-w-4xl">
          {/* Back button + Title row */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/[0.55] hover:text-white/[0.80] hover:bg-white/[0.04] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[13px] font-medium">Back</span>
            </button>
            <div className="flex-1">
              <h1 className="text-[24px] font-semibold text-text-primary" style={{ letterSpacing: '-0.01em' }}>
                Control Room
              </h1>
              <p className="text-[13px] text-white/[0.45] mt-0.5">
                Manage all your nodes in one place
              </p>
            </div>
          </div>

          {/* Search + Actions row */}
          <div className="flex items-center gap-3 mb-6">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/[0.35]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                className="w-full h-10 pl-10 pr-10 rounded-xl text-[13px] text-white/[0.90] placeholder-white/[0.40] bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-white/[0.14] focus:bg-white/[0.06] transition-all"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/[0.35] hover:text-white/[0.55] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/[0.30] font-mono">/</span>
              )}
            </div>

            {/* Primary action: New Node */}
            <button
              onClick={handleCreateNode}
              disabled={repositories.length === 0}
              className="h-10 px-5 flex items-center gap-2.5 rounded-xl text-[13px] font-medium
                         bg-white/[0.08] border border-white/[0.12] text-white/[0.90]
                         hover:bg-white/[0.12] hover:border-white/[0.16]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Node
            </button>

            {/* Multi-select actions */}
            {selectedIndices.length > 0 && (
              <>
                <div className="w-px h-6 bg-white/[0.08]" />
                <span className="text-[12px] text-white/[0.50] font-medium">
                  {selectedIndices.length} selected
                </span>
                <button
                  onClick={() => handleDelete(selectedIndices)}
                  className="h-10 px-4 rounded-xl text-[13px] font-medium text-[rgba(248,113,113,0.85)] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] hover:bg-[rgba(248,113,113,0.12)] transition-all"
                >
                  Kill Selected
                </button>
              </>
            )}
          </div>
        </div>

        {/* Node grid or empty state */}
        <div className="w-full max-w-4xl flex-1">
          {filteredItems.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/[0.30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-[16px] font-medium text-white/[0.75] mb-1">
                {searchQuery ? 'No nodes found' : 'No nodes yet'}
              </h3>
              <p className="text-[13px] text-white/[0.45] mb-6">
                {searchQuery ? 'Try a different search term' : 'Create your first node to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateNode}
                  disabled={repositories.length === 0}
                  className="h-10 px-5 flex items-center gap-2.5 rounded-xl text-[13px] font-medium
                             bg-white/[0.08] border border-white/[0.12] text-white/[0.90]
                             hover:bg-white/[0.12] hover:border-white/[0.16]
                             disabled:opacity-40 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Node
                </button>
              )}
            </div>
          ) : (
            /* Node grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pageItems.map((item, index) => {
                const absoluteIndex = startIndex + index;
                const isSelected = selectedIndex === absoluteIndex;
                const isMultiSelected = selectedIndices.includes(absoluteIndex);
                const cardData = nodeCardDataMap.get(item.id);

                return (
                  <div key={item.id} className="h-[180px]">
                    <NodeCard
                      item={item}
                      index={absoluteIndex}
                      isSelected={isSelected}
                      isMultiSelected={isMultiSelected}
                      onSelect={() => handleRangeSelect(absoluteIndex, false)}
                      onOpen={() => handleOpen(absoluteIndex)}
                      onMultiSelect={(e) => handleCardMultiSelect(absoluteIndex, e)}
                      cardData={cardData}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/[0.50] hover:text-white/[0.75] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[12px] text-white/[0.50] px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/[0.50] hover:text-white/[0.75] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Footer keyboard hints */}
        <div className="flex items-center justify-center gap-6 mt-8 pb-4">
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded text-[10px] text-white/[0.55] bg-white/[0.04] border border-white/[0.10] font-mono">↵</kbd>
            <span className="text-[11px] text-white/[0.40]">open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded text-[10px] text-white/[0.55] bg-white/[0.04] border border-white/[0.10] font-mono">esc</kbd>
            <span className="text-[11px] text-white/[0.40]">close</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded text-[10px] text-white/[0.55] bg-white/[0.04] border border-white/[0.10] font-mono">/</kbd>
            <span className="text-[11px] text-white/[0.40]">search</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded text-[10px] text-white/[0.55] bg-white/[0.04] border border-white/[0.10] font-mono">↑↓←→</kbd>
            <span className="text-[11px] text-white/[0.40]">navigate</span>
          </div>
        </div>
      </div>

      {/* Number input modal */}
      <NumberInputModal
        isOpen={showNumberInput}
        onClose={() => setShowNumberInput(false)}
        onSubmit={handleNumberSubmit}
        maxIndex={totalCards}
      />

      {/* Branch selection dialog */}
      {repositories.length > 0 && (
        <BranchSelectionDialog
          isOpen={branchDialogOpen}
          onClose={() => setBranchDialogOpen(false)}
          repoId={repositories[0].id}
          onBranchSelected={handleBranchSelected}
        />
      )}
    </div>
  );
}
