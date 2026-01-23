import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useNodeStore } from '../../stores/nodeStore';
import { useRepositoryStore } from '../../stores/repositoryStore';

interface BranchSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  onBranchSelected: (branch: string) => void;
}

export function BranchSelectionDialog({
  isOpen,
  onClose,
  repoId,
  onBranchSelected,
}: BranchSelectionDialogProps) {
  const { remoteBranches, fetchRemoteBranches } = useNodeStore();
  const { repositories } = useRepositoryStore();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeRepo = repositories.find((r) => r.id === repoId);
  const mainBranch = activeRepo?.main_branch || 'main';

  // Fetch branches when dialog opens
  useEffect(() => {
    if (isOpen && repoId) {
      setIsLoading(true);
      fetchRemoteBranches(repoId).finally(() => {
        setIsLoading(false);
      });
      // Default to origin/main branch (will be set properly after branches load)
      setSelectedBranch(`origin/${mainBranch}`);
    }
  }, [isOpen, repoId, fetchRemoteBranches, mainBranch]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedBranch('');
    }
  }, [isOpen]);

  // Filter branches based on search
  const filteredBranches = remoteBranches.filter((branch) =>
    branch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort branches: main/master first, then alphabetically
  const sortedBranches = [...filteredBranches].sort((a, b) => {
    const aIsMain = a.endsWith(`/${mainBranch}`) || a.endsWith('/main') || a.endsWith('/master');
    const bIsMain = b.endsWith(`/${mainBranch}`) || b.endsWith('/main') || b.endsWith('/master');
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    return a.localeCompare(b);
  });

  // Check if a branch is the default/main branch
  const isDefaultBranch = (branch: string) => {
    return branch.endsWith(`/${mainBranch}`) || branch === `origin/${mainBranch}`;
  };

  const handleConfirm = () => {
    if (selectedBranch) {
      onBranchSelected(selectedBranch);
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Select Parent Branch" size="md">
      <div className="p-6 space-y-4">
        <p className="text-sm text-text-secondary">
          Choose which branch to create your new node from:
        </p>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches..."
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-secondary rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:border-interactive"
          />
        </div>

        {/* Branch list */}
        <div className="max-h-60 overflow-y-auto border border-border-secondary rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-5 h-5 animate-spin text-text-tertiary" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : sortedBranches.length === 0 ? (
            <div className="py-8 text-center text-text-tertiary text-sm">
              {searchQuery ? 'No branches match your search' : 'No branches found'}
            </div>
          ) : (
            <div className="divide-y divide-border-secondary">
              {sortedBranches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => setSelectedBranch(branch)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedBranch === branch
                      ? 'bg-interactive/10 text-interactive'
                      : 'hover:bg-surface-hover text-text-primary'
                  }`}
                >
                  {/* Branch icon */}
                  <svg
                    className={`w-4 h-4 flex-shrink-0 ${
                      selectedBranch === branch ? 'text-interactive' : 'text-text-tertiary'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="truncate text-sm">{branch}</span>
                  {isDefaultBranch(branch) && (
                    <span className="ml-auto text-xs text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                      default
                    </span>
                  )}
                  {selectedBranch === branch && (
                    <svg
                      className="w-4 h-4 text-interactive ml-auto flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedBranch}
            className="px-4 py-2 text-sm bg-interactive text-white rounded-md hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Node
          </button>
        </div>
      </div>
    </Modal>
  );
}
