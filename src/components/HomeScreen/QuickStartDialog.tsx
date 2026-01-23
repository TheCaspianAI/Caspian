import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { useRepositoryStore } from '../../stores/repositoryStore';

export function QuickStartDialog() {
  const { quickStartDialogOpen, setQuickStartDialogOpen, setErrorMessage } = useUIStore();
  const { createDirectory, initRepository, isLoading } = useRepositoryStore();

  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');

  const handleSelectLocation = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select Project Location',
      });

      if (selected) {
        setLocation(selected as string);
      }
    } catch (err) {
      setErrorMessage(String(err));
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setErrorMessage('Please enter a project name');
      return;
    }

    if (!location.trim()) {
      setErrorMessage('Please select a location');
      return;
    }

    // Sanitize project name (remove special characters, replace spaces with hyphens)
    const sanitizedName = projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if (!sanitizedName) {
      setErrorMessage('Please enter a valid project name');
      return;
    }

    const fullPath = `${location}/${sanitizedName}`;

    // Create the directory
    const dirCreated = await createDirectory(fullPath);
    if (!dirCreated) {
      return;
    }

    // Initialize git repository
    const result = await initRepository(fullPath);

    if (result) {
      // Success - close dialog and reset
      setQuickStartDialogOpen(false);
      setProjectName('');
      setLocation('');
    }
  };

  const handleClose = () => {
    setQuickStartDialogOpen(false);
    setProjectName('');
    setLocation('');
  };

  // Generate preview path
  const sanitizedName = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  return (
    <Modal isOpen={quickStartDialogOpen} onClose={handleClose} title="Create New Project" size="md">
      <div className="p-6 space-y-4">
        {/* Project Name */}
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-text-secondary mb-1.5">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-awesome-project"
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:border-interactive focus:outline-none"
            autoFocus
          />
        </div>

        {/* Location */}
        <div>
          <label htmlFor="project-location" className="block text-sm font-medium text-text-secondary mb-1.5">
            Location
          </label>
          <div className="flex gap-2">
            <input
              id="project-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Select a folder..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:border-interactive focus:outline-none"
              readOnly
            />
            <button
              onClick={handleSelectLocation}
              className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              Browse
            </button>
          </div>
          {location && sanitizedName && (
            <p className="mt-1 text-xs text-text-tertiary">
              Will create: {location}/{sanitizedName}
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
            onClick={handleCreate}
            disabled={isLoading || !projectName.trim() || !location.trim()}
            className="px-4 py-2 bg-interactive text-white rounded-lg text-sm hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
