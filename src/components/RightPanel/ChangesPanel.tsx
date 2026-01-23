import { useEffect, useState, useRef, useCallback } from 'react';
import { safeInvoke, safeListen } from '../../utils/tauri';
import { useNodeStore, selectActiveNode, selectActiveNodeId } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { v4 as uuidv4 } from 'uuid';
import type { CommandResult } from '../../types';

type ViewMode = 'all' | 'uncommitted';

const VIEW_MODE_STORAGE_KEY = 'changes-panel-view-mode';

// Debounce threshold to prevent cascading fetches
const DIFF_FETCH_DEBOUNCE_MS = 300;

interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'remove' | 'context' | 'binary';
  content: string;
}

// Backend response type for changed files
interface ChangedFileResponse {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

// UI representation of a changed file
interface ChangedFile {
  filename: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  additions: number;
  deletions: number;
}

function parseDiff(diffText: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const diffLines = diffText.split('\n');

  for (const line of diffLines) {
    if (line.startsWith('diff --git')) {
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('@@')) {
      lines.push({ type: 'hunk', content: line });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lines.push({ type: 'remove', content: line.slice(1) });
    } else if (line.startsWith('Binary files')) {
      lines.push({ type: 'binary', content: line });
    } else if (line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      lines.push({ type: 'header', content: line });
    } else {
      lines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }

  return lines;
}

// Group files by directory
function groupByDirectory(files: ChangedFile[]): Map<string, ChangedFile[]> {
  const groups = new Map<string, ChangedFile[]>();

  for (const file of files) {
    const parts = file.filename.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    const existing = groups.get(dir) || [];
    groups.set(dir, [...existing, file]);
  }

  return groups;
}

export function ChangesPanel() {
  const activeNode = useNodeStore(selectActiveNode);
  const activeNodeId = useNodeStore(selectActiveNodeId);
  const openDiff = useUIStore(state => state.openDiff);
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return (stored === 'all' || stored === 'uncommitted') ? stored : 'all';
  });
  const [showMenu, setShowMenu] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);

  // Track in-flight fetch to prevent duplicate requests
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Keep refs in sync for use in event handlers
  activeNodeIdRef.current = activeNodeId;
  viewModeRef.current = viewMode;

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const fetchChangedFiles = useCallback(async (immediate = false) => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) {
      return;
    }

    // Skip if already fetching (prevents duplicate requests)
    if (isFetchingRef.current) {
      return;
    }

    // Skip if fetched recently (unless immediate is true)
    const now = Date.now();
    if (!immediate && now - lastFetchTimeRef.current < DIFF_FETCH_DEBOUNCE_MS) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;
    setIsLoading(true);
    setError(null);

    try {
      // Use different command based on view mode - fetch only file list, not full diffs
      const command = viewModeRef.current === 'uncommitted' ? 'get_changed_files' : 'get_branch_changed_files';
      const result = await safeInvoke<CommandResult<ChangedFileResponse[]>>(command, {
        nodeId: nodeId,
      });

      if (result?.success && result.data) {
        const files: ChangedFile[] = result.data.map(f => ({
          filename: f.filename,
          status: f.status as ChangedFile['status'],
          additions: f.additions,
          deletions: f.deletions,
        }));

        setChangedFiles(files);
        // Expand all directories by default
        const dirs = new Set<string>();
        files.forEach((f) => {
          const parts = f.filename.split('/');
          if (parts.length > 1) {
            dirs.add(parts.slice(0, -1).join('/'));
          }
        });
        setExpandedDirs(dirs);
      } else {
        setError(result?.error || 'Failed to fetch changed files');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch file list when node or viewMode changes
  // OPTIMIZATION: Defer initial load to not block main UI rendering
  useEffect(() => {
    if (activeNodeId) {
      // Use requestIdleCallback to defer until main thread is idle
      // This prevents blocking the main chat UI during node switching
      // Fall back to setTimeout for Safari which doesn't support requestIdleCallback
      if (typeof requestIdleCallback !== 'undefined') {
        const idleId = requestIdleCallback(() => fetchChangedFiles(true), { timeout: 500 });
        return () => cancelIdleCallback(idleId);
      } else {
        // Safari fallback - use setTimeout with small delay
        const timeoutId = setTimeout(() => fetchChangedFiles(true), 50);
        return () => clearTimeout(timeoutId);
      }
    } else {
      setChangedFiles([]);
    }
  }, [activeNodeId, viewMode, fetchChangedFiles]);

  // Manage file watcher lifecycle - start when node selected, stop when changed/deselected
  useEffect(() => {
    if (!activeNodeId) return;

    // Start watching the node's worktree
    safeInvoke<{ success: boolean; error?: string }>('start_file_watcher', {
      nodeId: activeNodeId,
    });

    // Stop watching when node changes or component unmounts
    return () => {
      safeInvoke<{ success: boolean }>('stop_file_watcher', {
        nodeId: activeNodeId,
      });
    };
  }, [activeNodeId]);

  // Subscribe to files:changed events for real-time updates (from file watcher)
  useEffect(() => {
    if (!activeNodeId) return;

    let unlisten: (() => void) | null = null;

    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string; paths: string[]; timestamp: number }>('files:changed', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          // Clear any pending refresh
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

          // Debounced fetch - fetchChangedFiles will skip if already fetching or too recent
          debounceTimerRef.current = setTimeout(() => fetchChangedFiles(false), DIFF_FETCH_DEBOUNCE_MS);
        }
      });
    };

    subscribe();

    return () => {
      if (unlisten) unlisten();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeNodeId, fetchChangedFiles]);

  // Subscribe to agent:complete for immediate refresh after agent finishes
  useEffect(() => {
    if (!activeNodeId) return;

    let unlisten: (() => void) | null = null;

    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string; success: boolean }>('agent:complete', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          // Clear any pending debounced refresh
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          // Immediate refresh when agent completes (use immediate=true)
          fetchChangedFiles(true);
        }
      });
    };

    subscribe();

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeNodeId, fetchChangedFiles]);

  // Keyboard shortcut: Shift+Cmd+C (Mac) / Shift+Ctrl+C (Windows) to toggle uncommitted view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setViewMode(prev => prev === 'uncommitted' ? 'all' : 'uncommitted');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDir = (dir: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  // Open file in diff tab - lazily fetch the diff content
  const handleFileClick = async (file: ChangedFile) => {
    if (!activeNodeId) return;

    setLoadingFile(file.filename);

    try {
      // Fetch diff for just this file
      const command = viewModeRef.current === 'uncommitted' ? 'get_file_diff' : 'get_branch_file_diff';
      const result = await safeInvoke<CommandResult<string>>(command, {
        nodeId: activeNodeId,
        filename: file.filename,
      });

      if (result?.success && result.data != null) {
        const diffLines = parseDiff(result.data);

        const status = file.status === 'added' || file.status === 'untracked'
          ? 'added'
          : file.status === 'deleted'
          ? 'deleted'
          : file.status === 'renamed'
          ? 'renamed'
          : 'modified';

        openDiff(activeNodeId, {
          id: uuidv4(),
          path: file.filename,
          name: file.filename.split('/').pop() || file.filename,
          status,
          content: diffLines,
        });
      } else {
        setError(result?.error || 'Failed to fetch file diff');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingFile(null);
    }
  };

  const groupedFiles = groupByDirectory(changedFiles);

  if (!activeNode) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-[200px]">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-surface-primary flex items-center justify-center">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-caption text-text-secondary mb-1">No node selected</p>
          <p className="text-caption text-text-muted">Select a node from the sidebar to view its changes</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary">
        <div className="flex items-center gap-2 text-caption">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <div className="bg-error/10 border border-error/30 rounded p-2">
          <p className="text-error text-caption">{error}</p>
          <button onClick={() => fetchChangedFiles(true)} className="mt-2 text-caption text-text-secondary hover:text-text-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary bar - minimal */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        {/* File count */}
        <span className="text-[13px] text-white/[0.50] flex-1">
          {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''}
        </span>

        {/* Refresh button */}
        <button
          onClick={() => fetchChangedFiles(true)}
          className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/50 transition-colors"
          title="Refresh"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* View mode menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/50 transition-colors"
            title="View options"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {showMenu && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              {/* Dropdown menu */}
              <div
                className="absolute right-0 top-full mt-1 z-20 glass-popover border border-white/[0.08] rounded-xl py-1 min-w-[180px]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
              >
                <button
                  onClick={() => {
                    setViewMode('all');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-caption text-text-primary hover:bg-surface-hover/50 flex items-center justify-between"
                >
                  <span>All changes</span>
                  {viewMode === 'all' && (
                    <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setViewMode('uncommitted');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-caption text-text-primary hover:bg-surface-hover/50 flex items-center justify-between"
                >
                  <span>Uncommitted changes</span>
                  <span className="flex items-center gap-1.5">
                    {viewMode === 'uncommitted' && (
                      <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="text-caption text-text-tertiary">shift+cmd+C</span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {changedFiles.length === 0 ? (
          <div className="px-3 py-4">
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-white/[0.35] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-[13px] text-white/[0.55] font-medium">
                  {viewMode === 'uncommitted' ? 'Working tree clean' : 'No changes'}
                </p>
                <p className="text-[12px] text-white/[0.40] mt-0.5">
                  {viewMode === 'uncommitted'
                    ? 'No uncommitted changes'
                    : 'No changes from parent branch'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-1 mx-2 rounded-lg bg-white/[0.02]">
            {Array.from(groupedFiles.entries()).map(([dir, files]) => (
              <div key={dir || 'root'}>
                {/* Directory header - matches FileBrowser spec */}
                {dir && (
                  <button
                    onClick={() => toggleDir(dir)}
                    className="w-full h-7 flex items-center gap-2 pr-2.5 text-left text-white/[0.60] hover:text-white/[0.75] hover:bg-white/[0.03] transition-colors"
                    style={{ paddingLeft: '12px', fontSize: '12px', fontWeight: 600 }}
                  >
                    <svg
                      className={`w-2.5 h-2.5 text-white/[0.45] transition-transform flex-shrink-0 ${expandedDirs.has(dir) ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-4 h-4 text-white/[0.60]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="font-mono truncate">{dir}/</span>
                  </button>
                )}

                {/* Files in directory - matches FileBrowser spec */}
                {(dir === '' || expandedDirs.has(dir)) &&
                  files.map((file) => {
                    const basename = file.filename.split('/').pop() || file.filename;
                    const isLoadingThisFile = loadingFile === file.filename;

                    return (
                      <button
                        key={file.filename}
                        onClick={() => handleFileClick(file)}
                        disabled={isLoadingThisFile}
                        className="w-full h-7 flex items-center gap-2 pr-2.5 text-left transition-colors group hover:bg-white/[0.04] disabled:opacity-50"
                        style={{ paddingLeft: dir ? `${14 + 12}px` : '12px', fontSize: '12px', fontWeight: 500 }}
                      >
                        {/* File icon with status color or loading spinner */}
                        {isLoadingThisFile ? (
                          <svg className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-white/[0.60]" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              file.status === 'added' || file.status === 'untracked' ? 'text-status-success/80' :
                              file.status === 'deleted' ? 'text-error/80' :
                              'text-warning/80'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <span className="text-white/[0.80] truncate flex-1 group-hover:text-white/[0.95] transition-colors">{basename}</span>
                        <span className="text-[11px] text-status-success/65">+{file.additions}</span>
                        <span className="text-[11px] text-error/65">-{file.deletions}</span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
