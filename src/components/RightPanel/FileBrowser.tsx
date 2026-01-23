import { useState, useEffect } from 'react';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore, selectActiveNode } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { isTauri } from '../../utils/tauri';
import { v4 as uuidv4 } from 'uuid';

// Safe wrappers for Tauri FS functions
const safeReadDir = async (path: string) => {
  if (!isTauri()) return [];
  const { readDir } = await import('@tauri-apps/plugin-fs');
  return readDir(path);
};

const safeReadTextFile = async (path: string) => {
  if (!isTauri()) return '';
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(path);
};

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

interface FileTreeNodeProps {
  entry: FileEntry;
  level: number;
  onFileClick: (path: string, name: string) => void;
}

function FileTreeNode({ entry, level, onFileClick }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (!entry.isDirectory) {
      onFileClick(entry.path, entry.name);
      return;
    }

    if (!isExpanded && children === null) {
      setIsLoading(true);
      try {
        const entries = await safeReadDir(entry.path);
        const fileEntries: FileEntry[] = entries
          .map((e) => ({
            name: e.name || '',
            path: `${entry.path}/${e.name}`,
            isDirectory: e.isDirectory || false,
          }))
          .filter((e) => e.name && !e.name.startsWith('.'))
          .sort((a, b) => {
            // Directories first, then alphabetically
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
        setChildren(fileEntries);
      } catch (err) {
        console.error('Failed to read directory:', err);
        setChildren([]);
      }
      setIsLoading(false);
    }

    setIsExpanded(!isExpanded);
  };

  const getFileIcon = () => {
    if (entry.isDirectory) {
      return isExpanded ? (
        <svg className="w-4 h-4 text-white/[0.60]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-white/[0.60]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }

    // File icon - slightly smaller than folders for differentiation
    return (
      <svg className="w-3.5 h-3.5 text-white/[0.50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`w-full h-7 flex items-center gap-2 pr-2.5 text-left transition-colors group
          ${entry.isDirectory
            ? 'text-white/[0.60] hover:text-white/[0.75] hover:bg-white/[0.03]'
            : 'text-white/[0.80] hover:text-white/[0.95] hover:bg-white/[0.04]'}
        `}
        style={{ paddingLeft: `${level * 14 + 12}px`, fontSize: '12px', fontWeight: entry.isDirectory ? 600 : 500 }}
      >
        {entry.isDirectory && (
          <svg
            className={`w-2.5 h-2.5 text-white/[0.45] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!entry.isDirectory && <span className="w-2.5" />}
        {getFileIcon()}
        <span className="truncate">{entry.name}</span>
        {isLoading && (
          <svg className="w-3 h-3 animate-spin text-white/[0.40] ml-auto flex-shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </button>

      {isExpanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileBrowser() {
  // Use selector to avoid re-renders from unrelated store changes
  const activeRepoId = useRepositoryStore(state => state.activeRepoId);
  const activeNode = useNodeStore(selectActiveNode);
  const openFile = useUIStore(state => state.openFile);

  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only use node's worktree path - never fall back to repo.path
  // All file operations should happen in the node's worktree
  const worktreePath = activeNode?.node.worktree_path;

  // OPTIMIZATION: Defer directory loading to not block main UI
  useEffect(() => {
    if (!worktreePath) {
      setRootEntries([]);
      return;
    }

    const loadRoot = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const entries = await safeReadDir(worktreePath);
        const fileEntries: FileEntry[] = entries
          .map((e) => ({
            name: e.name || '',
            path: `${worktreePath}/${e.name}`,
            isDirectory: e.isDirectory || false,
          }))
          .filter((e) => e.name && !e.name.startsWith('.'))
          .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
        setRootEntries(fileEntries);
      } catch (err) {
        console.error(`Failed to load files from ${worktreePath}:`, err);
        setError('Failed to load files');
      } finally {
        setIsLoading(false);
      }
    };

    // Defer until main thread is idle to not block chat UI
    // Use requestIdleCallback if available, otherwise fall back to setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      const idleId = requestIdleCallback(() => loadRoot(), { timeout: 500 });
      return () => cancelIdleCallback(idleId);
    } else {
      // Safari fallback - use setTimeout with small delay
      const timeoutId = setTimeout(loadRoot, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [worktreePath]);

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      md: 'markdown',
      txt: 'text',
      sh: 'bash',
      bash: 'bash',
      sql: 'sql',
    };
    return langMap[ext || ''] || 'text';
  };

  const handleFileClick = async (path: string, name: string) => {
    if (!activeNode) return;
    try {
      const content = await safeReadTextFile(path);
      openFile(activeNode.node.id, {
        id: uuidv4(),
        path,
        name,
        content,
        language: getLanguageFromPath(path),
      });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  if (!activeRepoId || !worktreePath) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-[200px]">
          <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-surface-primary flex items-center justify-center">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-caption text-text-secondary mb-1">
            {!activeRepoId ? 'No repository' : 'Preparing workspace'}
          </p>
          <p className="text-caption text-text-muted">
            {!activeRepoId ? 'Select a node to browse files' : 'Waiting for worktree to be ready...'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <svg className="w-5 h-5 animate-spin text-text-tertiary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-warning mb-2">
          <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-body text-text-secondary mb-1">Folder not found</div>
        <div className="text-caption text-text-tertiary">
          The repository folder may have been moved or deleted.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      {rootEntries.length === 0 ? (
        <div className="p-4 text-center text-text-tertiary text-body">
          No files found
        </div>
      ) : (
        rootEntries.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            level={0}
            onFileClick={handleFileClick}
          />
        ))
      )}
    </div>
  );
}
