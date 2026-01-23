import { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useNodeStore, selectActiveNodeId } from '../../stores/nodeStore';
import { useViewRouter } from '../../hooks/useViewRouter';
import { ChatTimeline } from '../Chat';
import { isTauri } from '../../utils/tauri';
import type { OpenFile, OpenDiff, DiffLine } from '../../types';

// Lazy load views that aren't always needed - reduces initial bundle size
const HomeScreen = lazy(() => import('../HomeScreen').then(m => ({ default: m.HomeScreen })));
const ControlRoom = lazy(() => import('../GridView/ControlRoom').then(m => ({ default: m.ControlRoom })));

// Loading fallback for lazy components - glass-main-content prevents white flash during transitions
function ViewLoadingFallback() {
  return (
    <div className="h-full flex items-center justify-center glass-main-content">
      <div className="flex items-center gap-2 text-text-tertiary">
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

// Safe wrapper for Tauri writeTextFile
const safeWriteTextFile = async (path: string, content: string) => {
  if (!isTauri()) return;
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  return writeTextFile(path, content);
};

// Editable file editor with auto-save
function FileEditor({ file, nodeId }: { file: OpenFile; nodeId: string }) {
  // Use selector to avoid re-renders from unrelated UI store changes
  const updateFileContent = useUIStore(state => state.updateFileContent);
  const [localContent, setLocalContent] = useState(file.content);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local content when file changes (e.g., switching tabs)
  useEffect(() => {
    setLocalContent(file.content);
    setSaveStatus('saved');
  }, [file.id, file.content]);

  // Auto-save with debounce
  const saveToFile = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await safeWriteTextFile(file.path, content);
      updateFileContent(nodeId, file.id, content);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save file:', err);
      setSaveStatus('unsaved');
    }
  }, [file.path, file.id, nodeId, updateFileContent]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    setSaveStatus('unsaved');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounced save (500ms after last keystroke)
    saveTimeoutRef.current = setTimeout(() => {
      saveToFile(newContent);
    }, 500);
  }, [saveToFile]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle Tab key for indentation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = localContent.substring(0, start) + '  ' + localContent.substring(end);

      setLocalContent(newContent);
      setSaveStatus('unsaved');

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);

      // Trigger debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveToFile(newContent);
      }, 500);
    }
  }, [localContent, saveToFile]);

  return (
    <div className="h-full flex flex-col">
      {/* Subtle toolbar with inline status */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-surface-primary/50">
        <span className="text-[11px] text-white/[0.50] truncate flex-1 font-mono">{file.path}</span>
        {/* Inline status indicator */}
        <span className={`text-[10px] flex items-center gap-1 ${
          saveStatus === 'saved' ? 'text-white/[0.35]' :
          saveStatus === 'saving' ? 'text-white/[0.50]' :
          'text-white/[0.60]'
        }`}>
          {saveStatus === 'saving' && (
            <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving' : 'Edited'}
        </span>
      </div>

      {/* Editor - reduced top padding, wider content */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="flex-1 w-full px-3 py-2 bg-transparent text-text-primary font-mono text-[12px] leading-[1.6] resize-none focus:outline-none"
        style={{ tabSize: 2 }}
        spellCheck={false}
      />
    </div>
  );
}

// Diff viewer for displaying file changes - premium, desaturated styling
function DiffViewer({ diff }: { diff: OpenDiff }) {
  return (
    <div className="h-full flex flex-col">
      {/* Subtle header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-surface-primary/50">
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            diff.status === 'added' ? 'text-status-success/70' :
            diff.status === 'deleted' ? 'text-error/70' :
            'text-warning/70'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-[11px] text-white/[0.50] font-mono truncate">{diff.path}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          diff.status === 'added' ? 'bg-status-success/10 text-status-success/70' :
          diff.status === 'deleted' ? 'bg-error/10 text-error/70' :
          'bg-warning/10 text-warning/70'
        }`}>
          {diff.status}
        </span>
      </div>

      {/* Diff content - desaturated, translucent highlights */}
      <div className="flex-1 overflow-auto py-1">
        <div className="font-mono text-[11px] leading-[1.5]">
          {diff.content
            .filter((l: DiffLine) => l.type !== 'header')
            .map((line: DiffLine, idx: number) => {
              let className = 'px-3 py-[1px] whitespace-pre';
              let prefix = ' ';

              switch (line.type) {
                case 'add':
                  className += ' bg-[rgba(46,160,67,0.18)] text-[rgba(180,255,200,0.85)] border-l-2 border-white/[0.06]';
                  prefix = '+';
                  break;
                case 'remove':
                  className += ' bg-[rgba(248,81,73,0.18)] text-[rgba(255,190,190,0.85)] border-l-2 border-white/[0.06]';
                  prefix = '-';
                  break;
                case 'hunk':
                  className += ' bg-white/[0.03] text-white/[0.40] py-1 mt-1.5 first:mt-0';
                  return (
                    <div key={idx} className={className}>
                      {line.content}
                    </div>
                  );
                case 'binary':
                  className += ' bg-white/[0.03] text-white/[0.50] italic py-1.5';
                  return (
                    <div key={idx} className={className}>
                      {line.content}
                    </div>
                  );
                default:
                  className += ' text-white/[0.55]';
              }

              return (
                <div key={idx} className={className}>
                  {prefix}{line.content}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export function MainPanel() {
  const { isHome, isControlRoom, isWorkspace } = useViewRouter();

  // Get the active node ID using a stable selector
  const activeNodeId = useNodeStore(selectActiveNodeId);

  // Get the entire per-node state objects (stable selectors)
  const activeTabIdByNode = useUIStore(state => state.activeTabIdByNode);
  const openFilesByNode = useUIStore(state => state.openFilesByNode);
  const openDiffsByNode = useUIStore(state => state.openDiffsByNode);

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

  // Find active file if viewing a file tab
  const activeFile = activeTabId !== 'chat'
    ? openFiles.find((f) => f.id === activeTabId)
    : null;

  // Find active diff if viewing a diff tab
  const activeDiff = activeTabId !== 'chat' && !activeFile
    ? openDiffs.find((d) => d.id === activeTabId)
    : null;

  // Determine what's visible vs hidden
  const showHomeScreen = isHome;
  const showControlRoom = isControlRoom;
  const showWorkspace = isWorkspace;

  // PERFORMANCE: Optimistic rendering - ChatTimeline renders immediately with cached data.
  // No skeleton needed for cache hits. Background revalidation happens transparently.

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative glass-main-content">
      {/* Home screen overlay - lazy loaded */}
      {showHomeScreen && (
        <div className="absolute inset-0 z-10">
          <Suspense fallback={<ViewLoadingFallback />}>
            <HomeScreen />
          </Suspense>
        </div>
      )}

      {/* Control Room overlay - lazy loaded */}
      {showControlRoom && (
        <div className="absolute inset-0 z-10">
          <Suspense fallback={<ViewLoadingFallback />}>
            <ControlRoom />
          </Suspense>
        </div>
      )}

      {/* Workspace content */}
      {showWorkspace && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content - shows chat, file editor, or diff viewer */}
          <div className="flex-1 overflow-hidden">
            {activeFile && activeNodeId ? (
              <div className="h-full overflow-auto">
                <FileEditor file={activeFile} nodeId={activeNodeId} />
              </div>
            ) : activeDiff ? (
              <div className="h-full overflow-auto">
                <DiffViewer diff={activeDiff} />
              </div>
            ) : (
              // ChatTimeline renders immediately with cached data (optimistic)
              <ChatTimeline />
            )}
          </div>
        </div>
      )}

      {/* Fallback for when there's no workspace context and not showing overlays */}
      {!showWorkspace && !showHomeScreen && !showControlRoom && (
        <div className="flex-1 flex items-center justify-center text-text-tertiary glass-main-content">
          <p>Select a workspace to start</p>
        </div>
      )}
    </div>
  );
}
