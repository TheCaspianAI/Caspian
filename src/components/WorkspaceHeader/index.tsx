import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore, selectActiveNodeId, selectActiveNode } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';
import { safeInvoke, safeListen } from '../../utils/tauri';
import { PRStatusBar } from '../TopBar/PRStatusBar';
import type { CommandResult, PrInfo } from '../../types';

export function WorkspaceHeader() {
  // Use granular selectors to avoid re-renders from unrelated store changes
  const repositories = useRepositoryStore(useShallow(state => state.repositories));
  const activeRepoId = useRepositoryStore(state => state.activeRepoId);
  const activeNode = useNodeStore(selectActiveNode);
  const activeNodeId = useNodeStore(selectActiveNodeId);
  // Use individual selectors for state and actions
  const remoteBranches = useNodeStore(useShallow(state => state.remoteBranches));
  const fetchRemoteBranches = useNodeStore(state => state.fetchRemoteBranches);
  const updateParentBranch = useNodeStore(state => state.updateParentBranch);
  const renameNode = useNodeStore(state => state.renameNode);
  const deleteNode = useNodeStore(state => state.deleteNode);
  const setCreatePRModalOpen = useUIStore(state => state.setCreatePRModalOpen);
  const isCreatingPR = useUIStore(state => state.isCreatingPR);
  const setIsCreatingPR = useUIStore(state => state.setIsCreatingPR);
  const spawnAgent = useAgentStore(state => state.spawnAgent);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [prInfo, setPrInfo] = useState<PrInfo | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);

  activeNodeIdRef.current = activeNodeId;

  const validateNodeName = useCallback((name: string): string | null => {
    if (!name.trim()) return 'Name cannot be empty';
    const invalidChars = name.replace(/[a-z0-9-]/g, '');
    if (invalidChars.length > 0) return `Invalid characters: ${[...new Set(invalidChars)].join(' ')}`;
    if (name.startsWith('-') || name.endsWith('-')) return 'Name cannot start or end with hyphen';
    if (name.includes('--')) return 'Name cannot have consecutive hyphens';
    return null;
  }, []);

  // Memoize activeRepo lookup
  const activeRepo = useMemo(() =>
    repositories.find((r) => r.id === activeRepoId),
    [repositories, activeRepoId]
  );
  const node = activeNode?.node;

  // Defer fetchRemoteBranches to not block initial render
  useEffect(() => {
    if (activeRepoId) {
      const timeoutId = setTimeout(() => {
        fetchRemoteBranches(activeRepoId);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [activeRepoId, fetchRemoteBranches]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const fetchPrInfo = useCallback(async () => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) { setPrInfo(null); return; }
    try {
      const result = await safeInvoke<CommandResult<PrInfo | null>>('get_pr_info', { nodeId });
      setPrInfo(result?.success ? result.data : null);
    } catch { setPrInfo(null); }
  }, []);

  const checkChanges = useCallback(async () => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) { setHasChanges(false); return; }
    try {
      const result = await safeInvoke<CommandResult<string>>('get_branch_diff', { nodeId });
      setHasChanges(result?.success && result?.data ? result.data.trim().length > 0 : false);
    } catch { setHasChanges(false); }
  }, []);

  useEffect(() => { checkChanges(); fetchPrInfo(); }, [activeNodeId, checkChanges, fetchPrInfo]);

  useEffect(() => {
    if (!activeNodeId) return;
    let unlisten: (() => void) | null = null;
    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string }>('agent:output', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => { checkChanges(); fetchPrInfo(); }, 1500);
        }
      });
    };
    subscribe();
    return () => { if (unlisten) unlisten(); if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [activeNodeId, checkChanges, fetchPrInfo]);

  useEffect(() => {
    if (!activeNodeId) return;
    let unlisten: (() => void) | null = null;
    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string }>('agent:complete', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          checkChanges(); fetchPrInfo(); setIsMerging(false); setIsCreatingPR(false);
        }
      });
    };
    subscribe();
    return () => { if (unlisten) unlisten(); };
  }, [activeNodeId, checkChanges, fetchPrInfo, setIsCreatingPR]);

  const handleStartEdit = () => { if (node) { setEditedName(node.display_name); setIsEditingName(true); } };

  const handleSave = async () => {
    const error = validateNodeName(editedName);
    if (error) { setValidationError(error); return; }
    if (node && editedName.trim() && editedName !== node.display_name) {
      await renameNode(node.id, editedName.trim(), true);
    }
    setIsEditingName(false);
    setValidationError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') { setIsEditingName(false); setValidationError(null); }
  };

  const handleParentBranchChange = async (branch: string) => {
    if (node && branch !== node.parent_branch) await updateParentBranch(node.id, branch);
    setIsDropdownOpen(false);
  };

  const handleMerge = async () => {
    if (!activeRepoId || !activeNodeId || !prInfo || !node?.worktree_path) return;
    setIsMerging(true);
    const prompt = prInfo.mergeable === 'CONFLICTING' || prInfo.mergeStateStatus === 'DIRTY'
      ? `The user wants to merge PR #${prInfo.number} but there are merge conflicts. Please resolve them.`
      : `The user wants to merge PR #${prInfo.number}. Run \`gh pr merge ${prInfo.number} --merge\`.`;
    // Use auto_approve mode to skip permission prompts for git/gh commands
    await spawnAgent(activeRepoId, activeNodeId, 'claude_code', prompt, node.worktree_path, undefined, undefined, undefined, 'auto_approve');
  };

  const handleDelete = async () => {
    if (!activeNodeId) return;
    setIsDeleting(true);
    await deleteNode(activeNodeId, true);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  const availableBranches = remoteBranches.length > 0 ? remoteBranches : (node ? [node.parent_branch] : []);

  if (!activeRepo || !node) {
    return (
      <div className="h-14 flex items-center px-6 border-b border-border-secondary" data-tauri-drag-region>
        <span className="text-body text-text-muted">Home</span>
      </div>
    );
  }

  return (
    <div className="h-14 flex items-center px-6 border-b border-border-secondary flex-shrink-0" data-tauri-drag-region>
      {/* Left: Node breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 text-text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>

        {isEditingName ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={editedName}
              onChange={(e) => {
                const sanitized = e.target.value.toLowerCase().replace(/ /g, '-');
                setEditedName(sanitized);
                setValidationError(validateNodeName(sanitized));
              }}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className={`bg-surface-secondary border rounded px-2 py-0.5 text-body text-text-primary focus:outline-none min-w-[120px] max-w-[200px] 2xl:max-w-[280px] 3xl:max-w-[350px] ${
                validationError ? 'border-error' : 'border-interactive'
              }`}
              style={{ width: `${Math.max(120, editedName.length * 8 + 20)}px` }}
            />
            {validationError && (
              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-error/10 border border-error/30 rounded text-caption text-error whitespace-nowrap z-50">
                {validationError}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="text-body text-text-primary hover:text-interactive transition-colors truncate max-w-[200px] 2xl:max-w-[280px] 3xl:max-w-[350px]"
            title="Click to edit node name"
          >
            {node.display_name}
          </button>
        )}

        <span className="text-text-tertiary text-body select-none">›</span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 text-body text-text-secondary hover:text-interactive transition-colors"
          >
            <span className="truncate max-w-[150px] 2xl:max-w-[220px] 3xl:max-w-[280px]">{node.parent_branch}</span>
            <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isDropdownOpen && (
            <div
              className="absolute top-full left-0 mt-1 glass-popover border border-white/[0.08] rounded-xl z-50 min-w-[180px] max-h-[300px] overflow-y-auto"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              {availableBranches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => handleParentBranchChange(branch)}
                  className={`w-full text-left px-3 py-2 text-body hover:bg-surface-primary transition-colors ${
                    branch === node.parent_branch ? 'text-interactive bg-surface-primary/50' : 'text-text-secondary'
                  }`}
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {prInfo ? (
          <PRStatusBar
            prInfo={prInfo}
            onMerge={handleMerge}
            onDelete={() => setShowDeleteConfirm(true)}
            isMerging={isMerging}
            isDeleting={isDeleting}
          />
        ) : (hasChanges || isCreatingPR) ? (
          <button
            onClick={() => setCreatePRModalOpen(true)}
            disabled={isCreatingPR}
            className={`flex items-center gap-1.5 px-3 py-1 text-caption font-medium rounded transition-colors ${
              isCreatingPR
                ? 'text-text-tertiary border border-border-primary cursor-not-allowed'
                : 'text-text-secondary hover:text-text-primary border border-border-primary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {isCreatingPR ? 'Creating PR...' : 'Create PR'}
          </button>
        ) : null}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="glass-popover border border-white/[0.08] rounded-xl p-4 max-w-sm mx-4"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <h3 className="text-body font-semibold text-text-primary mb-2">Delete Node</h3>
            <p className="text-caption text-text-secondary mb-4">
              This will permanently delete "{node.display_name}", including its worktree and git branch.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-caption font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-caption font-medium text-white bg-error hover:bg-error/90 rounded disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
