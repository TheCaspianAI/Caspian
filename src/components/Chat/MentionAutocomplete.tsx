import { useState, useEffect, useRef, useCallback } from 'react';
import { useNodeStore, selectActiveNode } from '../../stores/nodeStore';
import { isTauri } from '../../utils/tauri';

// Safe wrapper for readDir
const safeReadDir = async (path: string) => {
  if (!isTauri()) return [];
  const { readDir } = await import('@tauri-apps/plugin-fs');
  return readDir(path);
};

interface MentionAutocompleteProps {
  query: string;
  isOpen: boolean;
  onSelect: (mention: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

interface MentionOption {
  type: 'node' | 'file';
  value: string;
  label: string;
  description?: string;
}

export function MentionAutocomplete({
  query,
  isOpen,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const { nodes } = useNodeStore();
  const activeNode = useNodeStore(selectActiveNode);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileOptions, setFileOptions] = useState<MentionOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the node's worktree path for file browsing
  // This ensures we're browsing files in the correct working directory
  const worktreePath = activeNode?.node.worktree_path;

  // Fetch files when query looks like a path
  const fetchFiles = useCallback(async (searchQuery: string) => {
    if (!worktreePath || searchQuery.length < 1) {
      setFileOptions([]);
      return;
    }

    try {
      // Determine the directory to search
      // Detect if query looks like a file path
      let searchDir = worktreePath;
      let filePrefix = searchQuery.toLowerCase();

      if (searchQuery.includes('/')) {
        const lastSlash = searchQuery.lastIndexOf('/');
        const dirPart = searchQuery.substring(0, lastSlash);
        filePrefix = searchQuery.substring(lastSlash + 1).toLowerCase();
        searchDir = `${worktreePath}/${dirPart}`;
      }

      const entries = await safeReadDir(searchDir);
      const files: MentionOption[] = [];

      for (const entry of entries) {
        // Skip hidden files and common non-code directories
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'target' ||
            entry.name === '__pycache__') {
          continue;
        }

        const matchesPrefix = entry.name.toLowerCase().includes(filePrefix);
        if (!matchesPrefix && filePrefix) continue;

        const relativePath = searchQuery.includes('/')
          ? `${searchQuery.substring(0, searchQuery.lastIndexOf('/') + 1)}${entry.name}`
          : entry.name;

        files.push({
          type: 'file',
          value: relativePath,
          label: entry.name,
          description: entry.isDirectory ? 'Directory' : undefined,
        });
      }

      // Sort: directories first, then alphabetically
      files.sort((a, b) => {
        const aIsDir = a.description === 'Directory';
        const bIsDir = b.description === 'Directory';
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.label.localeCompare(b.label);
      });

      setFileOptions(files.slice(0, 10)); // Limit to 10 results
    } catch (err) {
      console.warn('Failed to fetch files:', err);
      setFileOptions([]);
    }
  }, [worktreePath]);

  // Fetch files when query changes
  useEffect(() => {
    if (isOpen) {
      fetchFiles(query);
    }
  }, [query, isOpen, fetchFiles]);

  // Build options from nodes
  const nodeOptions: MentionOption[] = nodes
    .filter((node) =>
      node.display_name.toLowerCase().includes(query.toLowerCase())
    )
    .map((node) => ({
      type: 'node' as const,
      value: node.display_name,
      label: node.display_name,
      description: node.goal || undefined,
    }));

  // Combine options: files first if query looks like path, else nodes first
  const isPathLikeQuery = query.includes('/') || query.includes('.');
  const options: MentionOption[] = isPathLikeQuery
    ? [...fileOptions, ...nodeOptions]
    : [...nodeOptions, ...fileOptions];

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (options[selectedIndex]) {
            onSelect(options[selectedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options, selectedIndex, onSelect, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || options.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 glass-popover overflow-hidden min-w-[200px] max-w-[300px]"
      style={position ? { top: position.top, left: position.left } : { bottom: '100%', left: 0, marginBottom: '4px' }}
    >
      <div className="py-1 max-h-[200px] overflow-y-auto">
        {options.map((option, index) => (
          <button
            key={`${option.type}-${option.value}`}
            onClick={() => onSelect(option.value)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-surface-hover'
                : 'hover:bg-surface-secondary'
            }`}
          >
            <span className="text-text-tertiary text-body">
              {option.type === 'node' ? '○' : option.description === 'Directory' ? '📁' : '📄'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium text-text-primary truncate">
                @{option.label}
              </div>
              {option.description && (
                <div className="text-caption text-text-tertiary truncate">
                  {option.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border-primary text-caption text-text-tertiary">
        <kbd className="px-1 bg-surface-secondary rounded">↑↓</kbd> Navigate ·{' '}
        <kbd className="px-1 bg-surface-secondary rounded">Tab</kbd> Select
      </div>
    </div>
  );
}
