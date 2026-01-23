import { useState } from 'react';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useUIStore } from '../../stores/uiStore';

export function MissingRepositoryDialog() {
  const { repositories, removeRepository, fetchRepositories } = useRepositoryStore();
  const { missingRepoDialogOpen, missingRepoId, setMissingRepoDialog } = useUIStore();

  const [isRemoving, setIsRemoving] = useState(false);

  const missingRepo = repositories.find((r) => r.id === missingRepoId);

  const handleRemove = async () => {
    if (!missingRepoId) return;

    setIsRemoving(true);
    try {
      const success = await removeRepository(missingRepoId);
      if (success) {
        setMissingRepoDialog(false);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDismiss = () => {
    setMissingRepoDialog(false);
  };

  const handleRefresh = async () => {
    await fetchRepositories();
    // Check if the repo now exists
    const { repositories: updatedRepos } = useRepositoryStore.getState();
    const repo = updatedRepos.find((r) => r.id === missingRepoId);
    if (repo?.path_exists) {
      setMissingRepoDialog(false);
    }
  };

  if (!missingRepoDialogOpen || !missingRepo) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="glass-popover rounded-xl w-full max-w-md border border-white/[0.08]"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Repository Not Found</h2>
            <p className="text-sm text-text-tertiary">The folder has been moved or deleted</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-sm text-text-tertiary mb-1">Repository</div>
            <div className="font-medium text-text-primary">{missingRepo.name}</div>
          </div>

          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-sm text-text-tertiary mb-1">Expected path</div>
            <div className="font-mono text-xs text-text-secondary break-all">{missingRepo.path}</div>
          </div>

          <p className="text-sm text-text-secondary">
            The repository folder could not be found at the expected location.
            It may have been moved, renamed, or deleted from your system.
          </p>
        </div>

        <div className="p-4 border-t border-border-primary space-y-2">
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="w-full px-4 py-2.5 bg-error/10 text-error rounded-lg hover:bg-error/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isRemoving ? 'Removing...' : 'Remove from list'}
          </button>

          <button
            onClick={handleRefresh}
            className="w-full px-4 py-2.5 bg-surface-hover text-text-secondary rounded-lg hover:bg-surface-active flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh (check again)
          </button>

          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2 text-text-tertiary hover:text-text-secondary text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
