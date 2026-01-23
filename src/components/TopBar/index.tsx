import { useState, useRef, useEffect, useCallback } from 'react';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore, selectActiveNodeId, selectActiveNode } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';
import { safeInvoke, safeListen } from '../../utils/tauri';
import { PRStatusBar } from './PRStatusBar';
import type { CommandResult, PrInfo } from '../../types';

export function TopBar() {
  const { repositories, activeRepoId } = useRepositoryStore();
  // Use selectors for reactive state
  const activeNode = useNodeStore(selectActiveNode);
  const activeNodeId = useNodeStore(selectActiveNodeId);
  const {
    remoteBranches,
    fetchRemoteBranches,
    updateParentBranch,
    renameNode,
    deleteNode,
  } = useNodeStore();
  const { setCreatePRModalOpen, isCreatingPR, setIsCreatingPR } = useUIStore();
  const { spawnAgent } = useAgentStore();

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
  const prRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);
  const isCreatingPRRef = useRef(false);

  // Keep refs in sync for use in event handlers
  activeNodeIdRef.current = activeNodeId;
  isCreatingPRRef.current = isCreatingPR;

  // Validate directory-safe name (matches backend sanitization rules)
  const validateNodeName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Name cannot be empty';
    }
    // Only allow lowercase alphanumeric and hyphens (spaces auto-converted, uppercase auto-lowercased)
    const invalidChars = name.replace(/[a-z0-9-]/g, '');
    if (invalidChars.length > 0) {
      return `Invalid characters: ${[...new Set(invalidChars)].join(' ')}`;
    }
    // Prevent leading/trailing hyphens
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Name cannot start or end with hyphen';
    }
    // Prevent consecutive hyphens
    if (name.includes('--')) {
      return 'Name cannot have consecutive hyphens';
    }
    return null;
  };

  const activeRepo = repositories.find((r) => r.id === activeRepoId);
  const node = activeNode?.node;

  // Fetch remote branches when repo changes
  useEffect(() => {
    if (activeRepoId) {
      fetchRemoteBranches(activeRepoId);
    }
  }, [activeRepoId, fetchRemoteBranches]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Fetch PR info for the current node
  const fetchPrInfo = useCallback(async () => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) {
      setPrInfo(null);
      return;
    }

    try {
      const result = await safeInvoke<CommandResult<PrInfo | null>>('get_pr_info', {
        nodeId: nodeId,
      });
      if (result?.success) {
        setPrInfo(result.data);
      } else {
        setPrInfo(null);
      }
    } catch {
      setPrInfo(null);
    }
  }, []);

  // Check for changes to show/hide Create PR button
  const checkChanges = useCallback(async () => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) {
      setHasChanges(false);
      return;
    }

    try {
      const result = await safeInvoke<CommandResult<string>>('get_branch_diff', {
        nodeId: nodeId,
      });
      if (result?.success && result?.data) {
        setHasChanges(result.data.trim().length > 0);
      } else {
        setHasChanges(false);
      }
    } catch {
      setHasChanges(false);
    }
  }, []);

  // Check changes and PR info when node changes
  useEffect(() => {
    checkChanges();
    fetchPrInfo();
  }, [activeNodeId, checkChanges, fetchPrInfo]);

  // Subscribe to agent output events with debouncing
  useEffect(() => {
    if (!activeNodeId) return;

    let unlisten: (() => void) | null = null;

    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string }>('agent:output', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            checkChanges();
            fetchPrInfo();
          }, 1500);
        }
      });
    };

    subscribe();
    return () => {
      if (unlisten) unlisten();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeNodeId, checkChanges, fetchPrInfo]);

  // Retry fetching PR info with exponential backoff (for after PR creation)
  const fetchPrInfoWithRetry = useCallback(async (retryCount = 0, maxRetries = 4) => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) return;

    // Clear any existing retry timer
    if (prRetryTimerRef.current) {
      clearTimeout(prRetryTimerRef.current);
      prRetryTimerRef.current = null;
    }

    try {
      const result = await safeInvoke<CommandResult<PrInfo | null>>('get_pr_info', {
        nodeId: nodeId,
      });

      if (result?.success && result?.data) {
        // Successfully got PR info
        setPrInfo(result.data);
        return;
      }

      // No PR info yet, retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s, 8s
        prRetryTimerRef.current = setTimeout(() => {
          fetchPrInfoWithRetry(retryCount + 1, maxRetries);
        }, delay);
      }
    } catch {
      // Error fetching, retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        const delay = (retryCount + 1) * 2000;
        prRetryTimerRef.current = setTimeout(() => {
          fetchPrInfoWithRetry(retryCount + 1, maxRetries);
        }, delay);
      }
    }
  }, []);

  // Subscribe to agent complete events for immediate refresh
  useEffect(() => {
    if (!activeNodeId) return;

    let unlisten: (() => void) | null = null;

    const subscribe = async () => {
      unlisten = await safeListen<{ node_id: string }>('agent:complete', (payload) => {
        if (payload.node_id === activeNodeIdRef.current) {
          // Clear any pending debounced refresh
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

          // Check if we were creating a PR - need retry mechanism due to GitHub API delay
          const wasCreatingPR = isCreatingPRRef.current;

          // Immediate refresh when agent completes
          checkChanges();
          setIsMerging(false);
          setIsCreatingPR(false);

          if (wasCreatingPR) {
            // Use retry mechanism for PR info after creation (GitHub API has indexing delay)
            fetchPrInfoWithRetry(0, 4);
          } else {
            // Normal fetch for non-PR-creation scenarios
            fetchPrInfo();
          }
        }
      });
    };

    subscribe();
    return () => {
      if (unlisten) unlisten();
      // Clean up retry timer on unmount
      if (prRetryTimerRef.current) clearTimeout(prRetryTimerRef.current);
    };
  }, [activeNodeId, checkChanges, fetchPrInfo, fetchPrInfoWithRetry]);

  const handleStartEdit = () => {
    if (node) {
      setEditedName(node.display_name);
      setIsEditingName(true);
    }
  };

  const handleSave = async () => {
    const error = validateNodeName(editedName);
    if (error) {
      setValidationError(error);
      return; // Don't save, keep editing
    }
    if (node && editedName.trim() && editedName !== node.display_name) {
      // Use renameNode which also renames git branch/worktree
      await renameNode(node.id, editedName.trim(), true);
    }
    setIsEditingName(false);
    setValidationError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setValidationError(null);
    }
  };

  const handleParentBranchChange = async (branch: string) => {
    if (node && branch !== node.parent_branch) {
      await updateParentBranch(node.id, branch);
    }
    setIsDropdownOpen(false);
  };

  const handleMerge = async () => {
    if (!activeRepoId || !activeNodeId || !prInfo || !node?.worktree_path) return;

    setIsMerging(true);

    const prompt = prInfo.mergeable === 'CONFLICTING' || prInfo.mergeStateStatus === 'DIRTY'
      ? `The user wants to merge PR #${prInfo.number} but there are merge conflicts.

Please follow these steps:
1. Run \`gh pr view ${prInfo.number} --json mergeStateStatus,mergeable\` to check current status
2. If there are conflicts, run \`git fetch origin\` and \`git merge origin/${node.parent_branch}\` to see the conflicts
3. List the conflicting files and explain the conflicts to the user
4. Ask if they want you to attempt to resolve the conflicts
5. If yes, resolve each conflict carefully, ensuring both changes are properly merged
6. After resolving, run \`git add .\` and \`git commit -m "Resolve merge conflicts"\`
7. Push the resolved changes with \`git push\`
8. Finally, merge the PR with \`gh pr merge ${prInfo.number} --merge\``
      : `The user wants to merge PR #${prInfo.number}.

Please follow these steps:
1. Run \`gh pr merge ${prInfo.number} --merge\` to merge the PR
2. Confirm the merge was successful
3. If there are any issues, explain them to the user`;

    // Use auto_approve mode to skip permission prompts for git/gh commands
    await spawnAgent(activeRepoId, activeNodeId, 'claude_code', prompt, node.worktree_path, undefined, undefined, undefined, 'auto_approve');
  };

  const handleDelete = async () => {
    if (!activeNodeId) return;
    setIsDeleting(true);
    await deleteNode(activeNodeId, true); // force=true to bypass state validation
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    // Node will be removed from store, activeNode will become null automatically
  };

  if (!activeRepo || !node) {
    return (
      <div className="glass-topbar flex items-center px-4" data-tauri-drag-region>
        <span className="text-body text-text-tertiary tracking-wide">No active node</span>
      </div>
    );
  }

  // Available branches for dropdown - include current if not in list
  const availableBranches = remoteBranches.length > 0
    ? remoteBranches
    : [node.parent_branch];

  return (
    <div className="glass-topbar flex items-center px-4 gap-2" data-tauri-drag-region>
      {/* Link icon */}
      <svg
        className="w-4 h-4 text-text-tertiary flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>

      {/* Node name (editable) */}
      {isEditingName ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => {
              // Auto-convert to lowercase and replace spaces with hyphens
              const sanitized = e.target.value.toLowerCase().replace(/ /g, '-');
              setEditedName(sanitized);
              setValidationError(validateNodeName(sanitized));
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={`bg-surface-secondary border rounded px-2 py-0.5 text-body text-text-primary focus:outline-none min-w-[120px] max-w-[300px] 2xl:max-w-[400px] 3xl:max-w-[500px] ${
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
          className="text-body text-text-primary hover:text-interactive transition-colors truncate max-w-[300px] 2xl:max-w-[400px] 3xl:max-w-[500px]"
          title="Click to edit node name"
        >
          {node.display_name}
        </button>
      )}

      {/* Separator */}
      <span className="text-text-tertiary text-body select-none">›</span>

      {/* Base branch selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1 text-body text-text-secondary hover:text-interactive transition-colors"
        >
          <span className="truncate max-w-[200px] 2xl:max-w-[280px] 3xl:max-w-[350px]">{node.parent_branch}</span>
          <svg
            className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && (
          <div
            className="absolute top-full left-0 mt-1 glass-popover border border-white/[0.08] rounded-xl z-50 min-w-[200px] max-h-[300px] overflow-y-auto"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            {availableBranches.map((branch) => (
              <button
                key={branch}
                onClick={() => handleParentBranchChange(branch)}
                className={`w-full text-left px-3 py-2 text-body hover:bg-surface-primary transition-colors ${
                  branch === node.parent_branch
                    ? 'text-interactive bg-surface-primary/50'
                    : 'text-text-secondary'
                }`}
              >
                {branch}
              </button>
            ))}
            {availableBranches.length === 0 && (
              <div className="px-3 py-2 text-body text-text-tertiary">
                No remote branches found
              </div>
            )}
            {/* Original parent branch (immutable) */}
            {node.original_parent_branch && (
              <div className="border-t border-border-primary mt-1 pt-2 px-3 pb-2">
                <div className="text-caption text-text-tertiary">
                  Created from: <span className="text-text-secondary">{node.original_parent_branch.replace(/^origin\//, '')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* PR Status or Create PR button */}
      {prInfo ? (
        <PRStatusBar
          prInfo={prInfo}
          onMerge={handleMerge}
          onDelete={() => setShowDeleteConfirm(true)}
          isMerging={isMerging}
          isDeleting={isDeleting}
        />
      ) : hasChanges || isCreatingPR ? (
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="glass-popover border border-white/[0.08] rounded-xl p-4 max-w-sm mx-4"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <h3 className="text-body font-semibold text-text-primary mb-2">Delete Node</h3>
            <p className="text-caption text-text-secondary mb-4">
              This will permanently delete "{node.display_name}", including its worktree and git branch. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-caption font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-caption font-medium text-white bg-error hover:bg-error/90 rounded transition-colors disabled:opacity-50"
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
