import { useState } from 'react';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * AddRepoPopover - Footer button with popover for adding repositories
 */
export function AddRepoPopover() {
  const [showOptions, setShowOptions] = useState(false);
  const { setCloneDialogOpen, setQuickStartDialogOpen } = useUIStore();

  const handleOpenFolder = async () => {
    setShowOptions(false);
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, title: 'Select Project Folder' });
    if (selected) {
      const { checkGitStatus, addRepository: addRepo } = useRepositoryStore.getState();
      const { setInitPromptDialogOpen, setViewMode } = useUIStore.getState();
      const status = await checkGitStatus(selected as string);
      if (status?.is_git_repo) {
        const repo = await addRepo(selected as string);
        if (repo) {
          const { ensureDefaultNode, setActiveNode } = useNodeStore.getState();
          const defaultNode = await ensureDefaultNode(repo.id);
          if (defaultNode) {
            setActiveNode(defaultNode.id);
            setViewMode('workspace');
          }
        }
      } else {
        setInitPromptDialogOpen(true, selected as string);
      }
    }
  };

  const handleCloneUrl = () => {
    setShowOptions(false);
    setCloneDialogOpen(true);
  };

  const handleCreateNew = () => {
    setShowOptions(false);
    setQuickStartDialogOpen(true);
  };

  return (
    <div className="flex-shrink-0 px-3 pb-3">
      <div className="h-px bg-white/[0.06] mb-2.5" />
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="w-full h-8 px-3 flex items-center justify-center gap-2 text-[12px] font-medium text-white/[0.75] bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-[10px] transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-white/[0.55]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Repository
      </button>

      {/* Popover */}
      {showOptions && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div
            className="absolute bottom-16 left-3 right-3 glass-popover border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <button
              onClick={handleOpenFolder}
              className="w-full px-3 py-2 text-[12px] text-text-secondary hover:bg-white/[0.04] hover:text-text-primary text-left transition-colors"
            >
              Open existing folder
            </button>
            <button
              onClick={handleCloneUrl}
              className="w-full px-3 py-2 text-[12px] text-text-secondary hover:bg-white/[0.04] hover:text-text-primary text-left transition-colors"
            >
              Clone from URL
            </button>
            <button
              onClick={handleCreateNew}
              className="w-full px-3 py-2 text-[12px] text-text-secondary hover:bg-white/[0.04] hover:text-text-primary text-left transition-colors"
            >
              Create new project
            </button>
          </div>
        </>
      )}
    </div>
  );
}
