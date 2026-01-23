import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useNodeStore, selectActiveNodeId } from '../../stores/nodeStore';

export function TabBar() {
  // Get the active node ID using a stable selector
  const activeNodeId = useNodeStore(selectActiveNodeId);

  // Get the entire per-node state objects (stable selectors)
  const activeTabIdByNode = useUIStore((state) => state.activeTabIdByNode);
  const openFilesByNode = useUIStore((state) => state.openFilesByNode);
  const openDiffsByNode = useUIStore((state) => state.openDiffsByNode);
  const setActiveTabId = useUIStore((state) => state.setActiveTabId);
  const closeFile = useUIStore((state) => state.closeFile);
  const closeDiff = useUIStore((state) => state.closeDiff);

  // Derive node-specific values outside selectors to avoid infinite loops
  const activeTabId = useMemo(() =>
    activeNodeId ? (activeTabIdByNode[activeNodeId] || 'chat') : 'chat',
    [activeNodeId, activeTabIdByNode]
  );
  const openFiles = useMemo(() =>
    activeNodeId ? (openFilesByNode[activeNodeId] || []) : [],
    [activeNodeId, openFilesByNode]
  );
  const openDiffs = useMemo(() =>
    activeNodeId ? (openDiffsByNode[activeNodeId] || []) : [],
    [activeNodeId, openDiffsByNode]
  );

  // Common tab chip styles
  const activeTabClass = 'text-text-primary bg-white/[0.08] border border-white/[0.08] shadow-sm';
  const inactiveTabClass = 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] border border-transparent';

  return (
    <div className="h-10 flex items-center px-4 gap-1 border-b border-white/[0.06] overflow-x-auto flex-shrink-0 scrollbar-none">
      {/* Chat tab - pinned, always first, not closable - real tab chip */}
      <button
        onClick={() => activeNodeId && setActiveTabId(activeNodeId, 'chat')}
        className={`h-[28px] flex items-center gap-1.5 px-3 text-[13px] font-medium rounded-md transition-all flex-shrink-0
          ${activeTabId === 'chat' ? activeTabClass : inactiveTabClass}`}
      >
        <svg className={`w-3.5 h-3.5 ${activeTabId === 'chat' ? 'text-interactive' : 'opacity-60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Chat
      </button>

      {/* Separator when there are other tabs */}
      {(openFiles.length > 0 || openDiffs.length > 0) && (
        <div className="h-4 w-px bg-white/[0.08] mx-1" />
      )}

      {/* File tabs - closable */}
      {openFiles.map((file) => (
        <div
          key={file.id}
          className={`h-[28px] flex items-center gap-1.5 px-3 rounded-md cursor-pointer group min-w-0 flex-shrink-0 transition-all
            ${activeTabId === file.id ? activeTabClass : inactiveTabClass}`}
          onClick={() => activeNodeId && setActiveTabId(activeNodeId, file.id)}
        >
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${activeTabId === file.id ? 'text-text-secondary' : 'opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[13px] font-medium truncate max-w-24">{file.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              activeNodeId && closeFile(activeNodeId, file.id);
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.10] transition-opacity flex-shrink-0 -mr-0.5"
            title="Close"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Diff tabs - closable, with "Diff" indicator */}
      {openDiffs.map((diff) => (
        <div
          key={diff.id}
          className={`h-[28px] flex items-center gap-1.5 px-3 rounded-md cursor-pointer group min-w-0 flex-shrink-0 transition-all
            ${activeTabId === diff.id ? activeTabClass : inactiveTabClass}`}
          onClick={() => activeNodeId && setActiveTabId(activeNodeId, diff.id)}
        >
          {/* Diff icon with status color */}
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              diff.status === 'added' ? 'text-status-success' :
              diff.status === 'deleted' ? 'text-error' :
              'text-warning'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[13px] font-medium truncate max-w-20">{diff.name}</span>
          <span className="text-[11px] text-white/[0.45] flex-shrink-0">Diff</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              activeNodeId && closeDiff(activeNodeId, diff.id);
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.10] transition-opacity flex-shrink-0 -mr-0.5"
            title="Close"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
