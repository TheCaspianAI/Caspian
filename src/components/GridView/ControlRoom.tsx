import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGridStore } from '../../stores/gridStore';
import { useNodeStore } from '../../stores/nodeStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { useViewRouter } from '../../hooks/useViewRouter';
import { useGridNavigation } from '../../hooks/useGridNavigation';
import { useNodeCardDataBatch } from '../../hooks/useNodeCardData';
import type { GridItem, GridCardStatus, Node as CaspianNode } from '../../types';

import { NodeCard } from './NodeCard';
import { NewNodeTile } from './NewNodeTile';
import { NumberInputModal } from './NumberInputModal';
import { useGridAudio } from './useGridAudio';
import { BranchSelectionDialog } from '../Modals/BranchSelectionDialog';

// Sort options - simplified to just 2
type SortOption = 'status' | 'repo';
type ViewMode = 'comfortable' | 'compact';

// Custom dropdown for sort options
function SortDropdown({ sortBy, setSortBy }: { sortBy: SortOption; setSortBy: (v: SortOption) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: { value: SortOption; label: string }[] = [
    { value: 'status', label: 'Sort: Status' },
    { value: 'repo', label: 'Sort: Repo' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-[130px] px-2.5 rounded-r-md text-[11px] text-white/[0.55] hover:text-white/[0.70] bg-transparent flex items-center justify-between transition-colors"
      >
        <span>{options.find(o => o.value === sortBy)?.label}</span>
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-1 right-0 min-w-[130px] glass-popover border border-white/[0.08] rounded-xl overflow-hidden z-50"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setSortBy(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                option.value === sortBy ? 'text-white/[0.85]' : 'text-white/[0.55]'
              }`}
            >
              {option.value === sortBy && (
                <svg className="w-3 h-3 text-interactive" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              )}
              <span className={option.value === sortBy ? '' : 'ml-5'}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Stable empty array reference to prevent recreating in useMemo
const EMPTY_SCOPE: string[] = [];

export function ControlRoom() {
  // Use individual selectors to prevent cascading re-renders
  const repositories = useRepositoryStore(state => state.repositories);
  const allNodes = useNodeStore(state => state.allNodes);
  const fetchAllNodes = useNodeStore(state => state.fetchAllNodes);
  const createNode = useNodeStore(state => state.createNode);
  const nodeStatus = useAgentStore(state => state.nodeStatus);

  // Fetch all nodes on mount and when repositories change
  useEffect(() => {
    fetchAllNodes();
  }, [fetchAllNodes, repositories.length]);
  const setActiveTabId = useUIStore(state => state.setActiveTabId);
  const { navigateToNode, toggleControlRoom } = useViewRouter();
  const { playNavigateSound, playSelectSound } = useGridAudio(true);
  const prevSelectedIndexRef = useRef<number | null>(null);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
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
  const getCardStatus = useCallback((node: CaspianNode): GridCardStatus => {
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
  const nodeCardDataMap = useNodeCardDataBatch(allNodes, { refreshInterval: 10000 });

  // Build grid items
  const gridItems = useMemo((): GridItem[] => {
    const items = allNodes.map(node => {
      const repo = repositories.find(r => r.id === node.repo_id);
      return {
        type: 'node' as const,
        id: node.id,
        name: node.display_name || node.internal_branch,
        node,
        agentType: 'claude_code' as const,
        status: getCardStatus(node),
        intent: node.goal || undefined,
        scope: EMPTY_SCOPE, // Use stable reference instead of inline []
        lastActive: node.last_active_at,
        path: repo?.name,
        repoId: node.repo_id,
      };
    });

    // Sort based on selected option
    if (sortBy === 'repo') {
      return items.sort((a, b) => (a.path || '').localeCompare(b.path || ''));
    }
    // Default: sort by status priority
    return items.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
  }, [repositories, allNodes, getCardStatus, nodeStatus, sortBy]);

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

  // Pagination - include New Node tile in count
  const pageSize = 9;
  const hasNewNodeTile = repositories.length > 0;
  const totalCards = filteredItems.length + (hasNewNodeTile ? 1 : 0);
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

  // Focus search on "/" key, close on Escape
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
          toggleControlRoom();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleControlRoom, setSearchQuery]);

  // Create node - defined before handleOpen since it's used there
  const handleCreateNode = useCallback(() => {
    if (repositories.length === 0) return;

    if (repositories.length === 1) {
      // Single repo - go straight to branch selection
      setSelectedRepoId(repositories[0].id);
      setBranchDialogOpen(true);
    } else {
      // Multiple repos - show repo picker first
      setRepoPickerOpen(true);
    }
  }, [repositories]);

  // Handle repo selection from picker
  const handleRepoSelected = useCallback((repoId: string) => {
    setSelectedRepoId(repoId);
    setRepoPickerOpen(false);
    setBranchDialogOpen(true);
  }, []);

  // Handle opening a card - use navigateToNode for optimized view switching
  const handleOpen = useCallback((index: number) => {
    playSelectSound();
    // Check if this is the New Node tile (last item)
    if (hasNewNodeTile && index === filteredItems.length) {
      handleCreateNode();
      return;
    }
    const item = filteredItems[index];
    if (item?.node) {
      navigateToNode(item.node.id, item.node.repo_id);
      setActiveTabId(item.node.id, 'chat');
    }
  }, [filteredItems, navigateToNode, setActiveTabId, playSelectSound, hasNewNodeTile, handleCreateNode]);

  // Handle delete
  const handleDelete = useCallback((_indices: number[]) => {
    // TODO: Implement node deletion
    clearSelection();
  }, [clearSelection]);

  // Navigation hook - account for New Node tile
  const itemsOnPage = pageItems.length + (hasNewNodeTile ? 1 : 0);
  const { handleRangeSelect, handleToggleSelect } = useGridNavigation({
    totalItems: totalCards,
    rows: Math.ceil(itemsOnPage / 3),
    cols: Math.min(3, itemsOnPage),
    onOpen: handleOpen,
    onClose: toggleControlRoom,
    onDelete: handleDelete,
    enabled: !showNumberInput,
  });

  const handleBranchSelected = useCallback(async (parentBranch: string) => {
    if (selectedRepoId) {
      await createNode(selectedRepoId, 'New node', parentBranch);
    }
    setBranchDialogOpen(false);
    setSelectedRepoId(null);
  }, [selectedRepoId, createNode]);

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

  // Get display count text
  const countText = useMemo(() => {
    if (searchQuery.trim()) {
      return `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`;
    }
    return `${filteredItems.length} node${filteredItems.length !== 1 ? 's' : ''}`;
  }, [filteredItems.length, searchQuery]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <div className="flex-shrink-0 sticky top-0 z-10 pt-4 pb-3 bg-[rgba(12,13,18,0.85)] backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1800px] w-full mx-auto px-8">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[17px] font-semibold text-white/[0.88]" style={{ letterSpacing: '-0.01em' }}>
                Control Room
              </h1>
              <span className="text-[11px] text-white/[0.45]">•</span>
              <span className="text-[11px] text-white/[0.50]">
                {countText}
              </span>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <button
                onClick={() => setViewMode('comfortable')}
                className={`p-1.5 rounded transition-all ${viewMode === 'comfortable' ? 'bg-white/[0.08] text-white/[0.70]' : 'text-white/[0.35] hover:text-white/[0.50]'}`}
                title="Comfortable view"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded transition-all ${viewMode === 'compact' ? 'bg-white/[0.08] text-white/[0.70]' : 'text-white/[0.35] hover:text-white/[0.50]'}`}
                title="Compact view"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Unified toolbar strip */}
          <div className="flex items-center h-8 rounded-md bg-white/[0.025] border border-white/[0.06]">
            {/* Search input */}
            <div className="relative flex-1">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/[0.30]"
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
                placeholder="Search  /"
                className="w-full h-full pl-8 pr-6 rounded-l-md text-[12px] text-white/[0.85] placeholder-white/[0.28] bg-transparent border-none focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/[0.30] hover:text-white/[0.50] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Sort dropdown */}
            <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
          </div>

          {/* Multi-select actions (if any selected) */}
          {selectedIndices.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-white/[0.50] font-medium">
                {selectedIndices.length} selected
              </span>
              <button
                onClick={() => handleDelete(selectedIndices)}
                className="h-7 px-2.5 rounded-md text-[10px] font-medium text-[rgba(248,113,113,0.75)] bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.10)] hover:bg-[rgba(248,113,113,0.10)] transition-all"
              >
                Kill
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto pb-12 pt-4 max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1800px] w-full mx-auto px-8">
          {filteredItems.length === 0 && !searchQuery ? (
            /* Empty state */
            <div className="flex flex-col items-start pt-6">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-dashed border-white/[0.12] flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-white/[0.35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-[13px] font-medium text-white/[0.60] mb-1">
                No nodes yet
              </h3>
              <p className="text-[11px] text-white/[0.38]">
                Create a node from the sidebar to get started
              </p>
            </div>
          ) : filteredItems.length === 0 && searchQuery ? (
            /* No search results */
            <div className="flex flex-col items-start pt-6">
              <p className="text-[12px] text-white/[0.45]">
                No nodes match "{searchQuery}"
              </p>
            </div>
          ) : (
            /* Node grid - responsive with view mode */
            <div className={`grid gap-2.5 ${
              viewMode === 'compact'
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {pageItems.map((item, index) => {
                const absoluteIndex = startIndex + index;
                const isSelected = selectedIndex === absoluteIndex;
                const isMultiSelected = selectedIndices.includes(absoluteIndex);
                const cardData = nodeCardDataMap.get(item.id);

                return (
                  <div key={item.id} className={viewMode === 'compact' ? 'h-[100px] 2xl:h-[110px] 3xl:h-[120px]' : 'h-[130px] 2xl:h-[145px] 3xl:h-[160px]'}>
                    <NodeCard
                      compact={viewMode === 'compact'}
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

              {/* New Node tile - always last */}
              {hasNewNodeTile && (
                <div className={viewMode === 'compact' ? 'h-[100px] 2xl:h-[110px] 3xl:h-[120px]' : 'h-[130px] 2xl:h-[145px] 3xl:h-[160px]'}>
                  <NewNodeTile
                    onClick={handleCreateNode}
                    compact={viewMode === 'compact'}
                    isSelected={selectedIndex === filteredItems.length}
                  />
                </div>
              )}
            </div>
          )}

          {/* Pagination (only if needed) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-white/[0.35] hover:text-white/[0.55] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[10px] text-white/[0.35] px-1.5">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="w-6 h-6 rounded flex items-center justify-center text-white/[0.35] hover:text-white/[0.55] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

      </div>

      {/* Minimal sticky footer - keyboard hints */}
      <div className="absolute bottom-0 left-0 right-0 px-8 py-2.5 pointer-events-none bg-gradient-to-t from-[rgba(8,9,12,0.8)] to-transparent">
        <div className="max-w-[1040px] 2xl:max-w-[1240px] 3xl:max-w-[1640px] mx-auto flex items-center gap-4 text-[9px] text-white/[0.30]">
          <span><kbd className="font-mono text-white/[0.40]">↵</kbd> open</span>
          <span><kbd className="font-mono text-white/[0.40]">⌘N</kbd> new</span>
          <span><kbd className="font-mono text-white/[0.40]">/</kbd> search</span>
        </div>
      </div>

      {/* Number input modal */}
      <NumberInputModal
        isOpen={showNumberInput}
        onClose={() => setShowNumberInput(false)}
        onSubmit={handleNumberSubmit}
        maxIndex={totalCards}
      />

      {/* Repo picker dialog - shown when multiple repos exist */}
      {repoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="glass-popover border border-white/[0.08] rounded-xl w-[320px] overflow-hidden"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border-primary">
              <h3 className="text-sm font-medium text-text-primary">Select Workspace</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Choose where to create the new node</p>
            </div>
            <div className="p-2 max-h-[300px] overflow-y-auto">
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelected(repo.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                             hover:bg-surface-secondary transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{repo.name}</div>
                    <div className="text-xs text-text-tertiary truncate">{repo.path}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end">
              <button
                onClick={() => setRepoPickerOpen(false)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch selection dialog */}
      {selectedRepoId && (
        <BranchSelectionDialog
          isOpen={branchDialogOpen}
          onClose={() => {
            setBranchDialogOpen(false);
            setSelectedRepoId(null);
          }}
          repoId={selectedRepoId}
          onBranchSelected={handleBranchSelected}
        />
      )}
    </div>
  );
}
