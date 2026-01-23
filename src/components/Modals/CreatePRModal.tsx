import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { useNodeStore, selectActiveNode, selectActiveNodeId } from '../../stores/nodeStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useAgentStore } from '../../stores/agentStore';
import { safeInvoke } from '../../utils/tauri';
import type { CommandResult } from '../../types';

// Custom dropdown for branch selection
function BranchDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-text-primary font-mono flex items-center justify-between hover:border-white/[0.12] transition-colors"
      >
        <span className="truncate">
          {options.length === 0 ? 'No branches available' : value || 'Select branch...'}
        </span>
        <svg
          className={`w-4 h-4 text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && options.length > 0 && (
        <div
          className="absolute top-full mt-1 left-0 right-0 glass-popover border border-white/[0.08] rounded-xl overflow-hidden z-50 max-h-[200px] overflow-y-auto scrollbar-overlay"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        >
          {options.map((branch) => (
            <button
              key={branch}
              type="button"
              onClick={() => {
                onChange(branch);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm font-mono hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                branch === value ? 'text-text-primary bg-white/[0.04]' : 'text-text-secondary'
              }`}
            >
              {branch === value && (
                <svg className="w-3.5 h-3.5 text-interactive flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              )}
              <span className={`truncate ${branch === value ? '' : 'ml-[22px]'}`}>{branch}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreatePRModal() {
  const { createPRModalOpen, setCreatePRModalOpen, setIsCreatingPR } = useUIStore();
  const activeNode = useNodeStore(selectActiveNode);
  const activeNodeId = useNodeStore(selectActiveNodeId);
  const { remoteBranches, fetchRemoteBranches } = useNodeStore();
  const { activeRepoId } = useRepositoryStore();
  const { spawnAgent } = useAgentStore();

  const [targetBranch, setTargetBranch] = useState<string>('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [diffSummary, setDiffSummary] = useState<{ files: number; additions: number; deletions: number } | null>(null);

  // Current branch from active node
  const currentBranch = activeNode?.node.internal_branch || '';

  // Fetch remote branches when modal opens
  useEffect(() => {
    if (createPRModalOpen && activeRepoId) {
      setIsLoadingBranches(true);
      fetchRemoteBranches(activeRepoId).finally(() => {
        setIsLoadingBranches(false);
      });

      // Fetch diff summary
      if (activeNodeId) {
        safeInvoke<CommandResult<string>>('get_diff', { nodeId: activeNodeId }).then((result) => {
          if (result?.success && result?.data) {
            const lines = result.data.split('\n');
            let additions = 0;
            let deletions = 0;
            const files = new Set<string>();

            for (const line of lines) {
              if (line.startsWith('diff --git')) {
                const match = line.match(/diff --git a\/(.+?) b\//);
                if (match) files.add(match[1]);
              } else if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
              }
            }

            setDiffSummary({
              files: files.size,
              additions,
              deletions,
            });
          } else {
            setDiffSummary(null);
          }
        });
      }
    }
  }, [createPRModalOpen, activeRepoId, activeNodeId, fetchRemoteBranches]);

  // Set default target branch when modal opens or branches load - prefer the node's parent_branch
  useEffect(() => {
    // Only run when modal is open and we have branches
    if (!createPRModalOpen || remoteBranches.length === 0) return;

    const parentBranch = activeNode?.node.parent_branch;
    // Filter out current branch
    const filtered = remoteBranches.filter(
      (b) => !b.endsWith(`/${currentBranch}`) && b !== currentBranch
    );

    if (parentBranch) {
      // Try to find the parent branch in available branches (with or without origin/ prefix)
      const matchingBranch = filtered.find(
        (b) => b === parentBranch || b === `origin/${parentBranch}` || b.endsWith(`/${parentBranch}`)
      );
      if (matchingBranch) {
        setTargetBranch(matchingBranch);
        return;
      }
    }

    // Fallback to first available branch
    if (filtered.length > 0) {
      setTargetBranch(filtered[0]);
    }
  }, [createPRModalOpen, remoteBranches, currentBranch, activeNode]);

  const handleClose = () => {
    setCreatePRModalOpen(false);
    setTargetBranch('');
    setDiffSummary(null);
  };

  const handleCreatePR = async () => {
    if (!activeNode || !activeRepoId || !activeNodeId || !targetBranch) return;

    const workingDir = activeNode.node.worktree_path;
    if (!workingDir) {
      console.error('No working directory for node');
      return;
    }

    setIsCreating(true);

    // Build the agent prompt
    const hasUncommittedChanges = diffSummary && diffSummary.files > 0;
    const upstreamStatus = 'There may not be an upstream branch yet.';
    const changesStatus = hasUncommittedChanges
      ? `There are uncommitted changes (${diffSummary.files} file${diffSummary.files !== 1 ? 's' : ''} modified).`
      : 'All changes are committed.';

    const prompt = `The user wants to create a Pull Request.
Current branch: ${currentBranch}
Target branch: ${targetBranch}
${upstreamStatus}
${changesStatus}

Follow these exact steps to create a PR:

1. Run \`git diff\` to review uncommitted changes (if any)
2. If there are uncommitted changes, commit them with a descriptive message
3. Push to origin (use \`-u\` flag if no upstream exists)
4. Review the changes that will be in the PR
5. Run \`gh pr create --base ${targetBranch.replace('origin/', '')}\` with:
   - Title under 80 characters
   - Description under 5 sentences

If any step fails, ask the user for help.`;

    try {
      // Use auto_approve mode to skip permission prompts for git/gh commands
      await spawnAgent(activeRepoId, activeNodeId, 'claude_code', prompt, workingDir, undefined, undefined, undefined, 'auto_approve');
      setIsCreatingPR(true); // Set global state before closing modal
      handleClose();
    } catch (err) {
      console.error('Failed to spawn agent:', err);
      setIsCreating(false);
    }
  };

  // Filter branches to exclude current branch
  const availableBranches = remoteBranches.filter(
    (b) => !b.endsWith(`/${currentBranch}`) && b !== currentBranch
  );

  return (
    <Modal isOpen={createPRModalOpen} onClose={handleClose} title="Create Pull Request" size="md">
      <div className="p-6 space-y-6">
        {/* Target branch selector */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            Target Branch
          </label>
          {isLoadingBranches ? (
            <div className="px-3 py-2 bg-surface-secondary border border-border-primary rounded text-sm text-text-tertiary">
              Loading branches...
            </div>
          ) : (
            <BranchDropdown
              value={targetBranch}
              onChange={setTargetBranch}
              options={availableBranches}
            />
          )}
        </div>

        {/* Changes summary */}
        {diffSummary && diffSummary.files > 0 && (
          <div className="px-3 py-2 bg-surface-hover/30 border border-border-secondary rounded">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-text-secondary">
                {diffSummary.files} file{diffSummary.files !== 1 ? 's' : ''} changed
              </span>
              <span className="text-success">+{diffSummary.additions}</span>
              <span className="text-error">-{diffSummary.deletions}</span>
            </div>
          </div>
        )}

        {/* Info notice */}
        <div className="px-3 py-2 bg-interactive/10 border border-interactive/20 rounded">
          <p className="text-xs text-text-secondary">
            The agent will review changes, commit if needed, push to origin, and create a PR.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePR}
            disabled={!targetBranch || isCreating || isLoadingBranches}
            className="px-4 py-2 text-sm font-medium text-white bg-interactive hover:bg-interactive-hover rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Starting...' : 'Create PR'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
