import { useMemo, useCallback, memo, useRef } from 'react';
import type { GridItem, GridCardStatus, NodeCardData } from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';
import { truncatePath } from '../../utils/stringUtils';
import { getToolDisplayName } from '../../utils/toolUtils';
import { prefetchNodeOnHover } from '../../utils/nodeDataCoordinator';

// Debounce delay for prefetch on hover
const PREFETCH_HOVER_DELAY_MS = 150;

interface NodeCardProps {
  item: GridItem;
  index: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMultiSelect: (e: React.MouseEvent) => void;
  cardData?: NodeCardData | null;
  compact?: boolean;
}

// Status colors - module-level constant to prevent recreation on each render
const STATUS_COLORS: Record<GridCardStatus, { bg: string; text: string; dot: string; border: string }> = {
  thinking: { bg: 'bg-[rgba(251,191,36,0.06)]', text: 'text-[rgba(251,191,36,0.65)]', dot: 'bg-[rgba(251,191,36,0.70)]', border: 'border-[rgba(251,191,36,0.12)]' },
  idle: { bg: 'bg-white/[0.03]', text: 'text-white/[0.45]', dot: 'bg-white/[0.40]', border: 'border-white/[0.06]' },
  needs_input: { bg: 'bg-[rgba(255,122,237,0.06)]', text: 'text-[rgba(255,122,237,0.65)]', dot: 'bg-[rgba(255,122,237,0.70)]', border: 'border-[rgba(255,122,237,0.12)]' },
  failed: { bg: 'bg-[rgba(248,113,113,0.06)]', text: 'text-[rgba(248,113,113,0.65)]', dot: 'bg-[rgba(248,113,113,0.70)]', border: 'border-[rgba(248,113,113,0.12)]' },
  completed: { bg: 'bg-[rgba(80,200,120,0.06)]', text: 'text-[rgba(80,200,120,0.65)]', dot: 'bg-[rgba(80,200,120,0.70)]', border: 'border-[rgba(80,200,120,0.12)]' },
} as const;

const STATUS_LABELS: Record<GridCardStatus, string> = {
  thinking: 'Running',
  idle: 'Idle',
  needs_input: 'Needs Input',
  failed: 'Failed',
  completed: 'Completed',
} as const;

// Helper functions moved to utility files:
// - formatRelativeTime → src/utils/dateUtils.ts
// - getToolDisplayName → src/utils/toolUtils.ts
// - truncatePath → src/utils/stringUtils.ts

export const NodeCard = memo(function NodeCard({
  item,
  index,
  isSelected,
  isMultiSelected,
  onSelect,
  onOpen,
  onMultiSelect,
  cardData,
  compact = false,
}: NodeCardProps) {
  const status = item.status || 'idle';
  const colors = STATUS_COLORS[status];

  // Memoize derived values to prevent recalculation on each render
  const derivedData = useMemo(() => ({
    title: cardData?.context || cardData?.goal || item.intent || item.name,
    branchName: cardData?.internalBranch || item.node?.internal_branch || '',
    originalParentBranch: cardData?.originalParentBranch || item.node?.original_parent_branch || null,
    currentTool: cardData?.currentTool,
    currentToolInput: cardData?.currentToolInput,
    model: cardData?.model || 'Claude',
    prInfo: cardData?.prInfo,
    errorCount: cardData?.errorCount || 0,
  }), [cardData, item.intent, item.name, item.node?.internal_branch, item.node?.original_parent_branch]);

  // Memoize relative time to prevent recalculation
  const relativeTime = useMemo(() => {
    return item.lastActive ? formatRelativeTime(item.lastActive) : null;
  }, [item.lastActive]);

  // Stable event handlers using useCallback
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      onMultiSelect(e);
    } else if (e.shiftKey) {
      onMultiSelect(e);
    } else if (isSelected) {
      // Already selected → open the node
      onOpen();
    } else {
      // Not selected → select it first
      onSelect();
    }
  }, [onMultiSelect, onOpen, onSelect, isSelected]);

  const handleDoubleClick = useCallback(() => {
    // Double click always opens (regardless of selection state)
    onOpen();
  }, [onOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onOpen();
    }
  }, [onOpen]);

  // Prefetch on hover (debounced)
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    // Only prefetch for node items that aren't already selected
    if (item.type !== 'node' || isSelected || !item.node?.id) return;

    prefetchTimerRef.current = setTimeout(() => {
      if (item.node?.id) {
        // Pass repoId so messages can also be prefetched
        prefetchNodeOnHover(item.node.id, item.node.repo_id);
      }
    }, PREFETCH_HOVER_DELAY_MS);
  }, [item.type, item.node?.id, item.node?.repo_id, isSelected]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  // Folder card rendering - premium glass style with focus ring
  if (item.type === 'folder') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative cursor-pointer
          w-full h-full p-5 flex flex-col justify-between
          rounded-2xl backdrop-blur-[16px] transition-all duration-150
          ${isSelected
            ? 'bg-white/[0.06] border border-white/[0.15]'
            : 'bg-[rgba(18,20,26,0.60)] border border-white/[0.06] hover:bg-[rgba(18,20,26,0.70)] hover:border-white/[0.08]'}
          ${isMultiSelected ? 'ring-1 ring-[rgba(255,122,237,0.25)]' : ''}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
        `}
        style={{
          boxShadow: isSelected
            ? '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Folder icon */}
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <svg className="w-4 h-4 text-white/[0.50]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span className="text-[11px] text-white/[0.50] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
            {item.nodeCount} nodes
          </span>
        </div>

        {/* Folder name */}
        <div>
          <h3 className="text-[15px] font-medium text-white/[0.92] truncate">
            {item.name}
          </h3>
          {item.path && (
            <p className="text-[12px] text-white/[0.50] truncate mt-0.5 font-mono">
              {item.path}
            </p>
          )}
        </div>

        {/* Multi-select checkbox */}
        {isMultiSelected && (
          <div className="absolute top-2 right-2 w-4 h-4 rounded bg-[rgba(255,122,237,0.80)] flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Index indicator */}
        <div className="absolute bottom-2 right-2 text-[9px] text-white/[0.20]">
          {index + 1}
        </div>
      </div>
    );
  }

  // Destructure memoized derived data
  const { title, branchName, originalParentBranch, currentTool, currentToolInput, model, prInfo, errorCount } = derivedData;

  // Format original parent branch for display (strip origin/ prefix)
  const formattedOriginalParent = originalParentBranch?.replace(/^origin\//, '') || null;

  // Node card rendering - supports compact and comfortable modes
  if (compact) {
    // Compact mode - minimal info, dense layout
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={title}
        className={`
          relative cursor-pointer group
          w-full h-full p-2.5 flex flex-col
          rounded-md backdrop-blur-[12px] transition-all duration-150
          ${isSelected
            ? 'bg-white/[0.06] border border-white/[0.14]'
            : 'bg-[rgba(18,20,26,0.50)] border border-white/[0.05] hover:bg-[rgba(18,20,26,0.60)] hover:border-white/[0.09]'}
          ${isMultiSelected ? 'ring-1 ring-[rgba(255,122,237,0.25)]' : ''}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15]
          hover:-translate-y-0.5
        `}
        style={{
          boxShadow: isSelected
            ? '0 0 0 1px rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.25)'
            : '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {/* Title - single line */}
        <h3 className="text-[11px] font-medium text-white/[0.85] truncate">
          {title}
        </h3>

        {/* Branch + from info */}
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          <span className="text-[9px] font-mono text-white/[0.40] truncate">
            {branchName}
          </span>
          {formattedOriginalParent && (
            <>
              <span className="text-[8px] text-white/[0.25] flex-shrink-0">from</span>
              <span className="text-[8px] text-white/[0.35] truncate">{formattedOriginalParent}</span>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Status only */}
        <div className="flex items-center gap-1 mt-1">
          <span className={`inline-flex items-center gap-1 text-[8px] px-1 py-[2px] rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
            <span className={`w-1 h-1 rounded-full ${colors.dot} ${status === 'thinking' ? 'animate-pulse' : ''}`} />
            {STATUS_LABELS[status]}
          </span>
          {relativeTime && (
            <span className="text-[8px] text-white/[0.30] ml-auto">
              {relativeTime}
            </span>
          )}
        </div>

        {isMultiSelected && (
          <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded bg-[rgba(255,122,237,0.75)] flex items-center justify-center">
            <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Comfortable mode - full info
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title}
      className={`
        relative cursor-pointer group
        w-full h-full p-3.5 flex flex-col
        rounded-lg backdrop-blur-[12px] transition-all duration-150
        ${isSelected
          ? 'bg-white/[0.06] border border-white/[0.14]'
          : 'bg-[rgba(18,20,26,0.50)] border border-white/[0.05] hover:bg-[rgba(18,20,26,0.60)] hover:border-white/[0.09]'}
        ${isMultiSelected ? 'ring-1 ring-[rgba(255,122,237,0.25)]' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15]
        hover:-translate-y-0.5
      `}
      style={{
        boxShadow: isSelected
          ? '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.30)'
          : '0 2px 8px rgba(0,0,0,0.20)',
      }}
    >
      {/* Primary: Title - larger, higher contrast */}
      <h3 className="text-[13px] font-medium text-white/[0.88] line-clamp-2 leading-[1.35]">
        {title}
      </h3>

      {/* Secondary: Branch + From info */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-white/[0.50] min-w-0">
        {/* Git branch icon */}
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-white/[0.40]" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
        </svg>
        {/* Branch name - can truncate */}
        <span className="font-mono truncate" title={branchName}>{branchName}</span>
        {/* Original parent branch */}
        {formattedOriginalParent && (
          <>
            <span className="text-white/[0.30] flex-shrink-0">from</span>
            <span className="text-white/[0.45] flex-shrink-0 font-medium">{formattedOriginalParent}</span>
          </>
        )}
        {/* Repo context */}
        {item.path && (
          <>
            <span className="text-white/[0.30] flex-shrink-0">·</span>
            <span className="text-white/[0.40] flex-shrink-0">{item.path}</span>
          </>
        )}
      </div>

      {/* Current activity (when agent is running) */}
      {status === 'thinking' && currentTool && (
        <div className="mt-1.5 flex-1">
          <div className="w-full px-2 py-1 rounded bg-white/[0.025] border-l-2 border-[rgba(251,191,36,0.40)]">
            <div className="flex items-center gap-1.5 text-[9px] text-white/[0.50]">
              <div className="w-1 h-1 rounded-full bg-[rgba(251,191,36,0.70)] animate-pulse" />
              <span className="font-medium">{getToolDisplayName(currentTool)}</span>
              {currentToolInput && (
                <span className="text-white/[0.30] truncate font-mono">
                  {truncatePath(currentToolInput, 20)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer when not running */}
      {!(status === 'thinking' && currentTool) && <div className="flex-1" />}

      {/* Bottom: Chips row - consistent bottom-left position */}
      <div className="flex items-center gap-1 mt-1.5">
        {/* Status chip - smaller, softer */}
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[3px] rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
          <span className={`w-1 h-1 rounded-full ${colors.dot} ${status === 'thinking' ? 'animate-pulse' : ''}`} />
          {STATUS_LABELS[status]}
        </span>

        {/* Model chip */}
        <span className="text-[9px] px-1.5 py-[3px] rounded bg-white/[0.025] text-white/[0.38] border border-white/[0.04]">
          {model}
        </span>

        {/* PR badge */}
        {prInfo && (
          <span className="text-[9px] px-1.5 py-[3px] rounded bg-white/[0.025] text-white/[0.42] border border-white/[0.04]">
            PR #{prInfo.number}
          </span>
        )}

        {/* Error count */}
        {errorCount > 0 && (
          <span className="text-[9px] px-1.5 py-[3px] rounded bg-[rgba(248,113,113,0.05)] text-[rgba(248,113,113,0.60)] border border-[rgba(248,113,113,0.10)]">
            {errorCount}
          </span>
        )}

        {/* Time - pushed right, slightly more visible */}
        {relativeTime && (
          <span className="text-[9px] text-white/[0.35] ml-auto">
            {relativeTime}
          </span>
        )}
      </div>

      {/* Multi-select checkbox */}
      {isMultiSelected && (
        <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded bg-[rgba(255,122,237,0.75)] flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
});
