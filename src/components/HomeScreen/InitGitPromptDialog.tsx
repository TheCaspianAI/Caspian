import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore } from '../../stores/nodeStore';

export function InitGitPromptDialog() {
  const { initPromptDialogOpen, pendingInitPath, setInitPromptDialogOpen } = useUIStore();
  const { initRepository, isLoading } = useRepositoryStore();

  const handleInit = async () => {
    if (!pendingInitPath) return;

    const result = await initRepository(pendingInitPath);

    if (result) {
      // Auto-create and select a node for the new workspace
      const { ensureDefaultNode, setActiveNode } = useNodeStore.getState();
      const defaultNode = await ensureDefaultNode(result.id);
      if (defaultNode) {
        setActiveNode(defaultNode.id);
      }
      setInitPromptDialogOpen(false);
    }
  };

  const handleClose = () => {
    setInitPromptDialogOpen(false);
  };

  // Extract folder name from path
  const folderName = pendingInitPath?.split('/').pop() || 'folder';

  return (
    <Modal isOpen={initPromptDialogOpen} onClose={handleClose} title="Initialize Git Repository" size="sm">
      <div className="p-6 space-y-4">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-text-primary font-medium mb-2">Not a Git Repository</h3>

          <p className="text-sm text-text-secondary">
            The folder <span className="font-medium text-text-primary">"{folderName}"</span> is not a Git repository.
          </p>

          <p className="text-sm text-text-tertiary mt-2">
            Would you like to initialize it as a new Git repository?
          </p>
        </div>

        {/* Path display */}
        <div className="bg-bg-secondary rounded-lg px-3 py-2">
          <p className="text-xs text-text-tertiary truncate">{pendingInitPath}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleInit}
            disabled={isLoading}
            className="px-4 py-2 bg-interactive text-white rounded-lg text-sm hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Initializing...' : 'Initialize Git'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
