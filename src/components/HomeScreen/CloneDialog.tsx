import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore } from '../../stores/nodeStore';

export function CloneDialog() {
  const { cloneDialogOpen, setCloneDialogOpen, setErrorMessage } = useUIStore();
  const { cloneRepository, isLoading, error: repoError, clearError } = useRepositoryStore();

  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');

  // Show error toast when repository store has an error
  useEffect(() => {
    if (repoError) {
      setErrorMessage(repoError);
      clearError();
    }
  }, [repoError, setErrorMessage, clearError]);

  const handleSelectDestination = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select Clone Destination',
      });

      if (selected) {
        setDestination(selected as string);
      }
    } catch (err) {
      setErrorMessage(String(err));
    }
  };

  const handleClone = async () => {
    if (!url.trim()) {
      setErrorMessage('Please enter a repository URL');
      return;
    }

    if (!destination.trim()) {
      setErrorMessage('Please select a destination folder');
      return;
    }

    // Extract repo name from URL for the full path
    const repoName = url.split('/').pop()?.replace('.git', '') || 'repo';
    const fullPath = `${destination}/${repoName}`;

    const result = await cloneRepository(url.trim(), fullPath);

    if (result) {
      // Auto-create and select a node for the new workspace
      const { ensureDefaultNode, setActiveNode } = useNodeStore.getState();
      const defaultNode = await ensureDefaultNode(result.id);
      if (defaultNode) {
        setActiveNode(defaultNode.id);
      }
      // Success - close dialog and reset
      setCloneDialogOpen(false);
      setUrl('');
      setDestination('');
    }
  };

  const handleClose = () => {
    setCloneDialogOpen(false);
    setUrl('');
    setDestination('');
  };

  return (
    <Modal isOpen={cloneDialogOpen} onClose={handleClose} title="Clone Repository" size="md">
      <div className="p-6 space-y-4">
        {/* URL Input */}
        <div>
          <label htmlFor="clone-url" className="block text-sm font-medium text-text-secondary mb-1.5">
            Repository URL
          </label>
          <input
            id="clone-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:border-interactive focus:outline-none"
            autoFocus
          />
        </div>

        {/* Destination */}
        <div>
          <label htmlFor="clone-destination" className="block text-sm font-medium text-text-secondary mb-1.5">
            Clone to
          </label>
          <div className="flex gap-2">
            <input
              id="clone-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Select a folder..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:border-interactive focus:outline-none"
              readOnly
            />
            <button
              onClick={handleSelectDestination}
              className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              Browse
            </button>
          </div>
          {destination && (
            <p className="mt-1 text-xs text-text-tertiary">
              Will clone to: {destination}/{url.split('/').pop()?.replace('.git', '') || 'repo'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={isLoading || !url.trim() || !destination.trim()}
            className="px-4 py-2 bg-interactive text-white rounded-lg text-sm hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
