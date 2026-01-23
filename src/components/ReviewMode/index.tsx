import { useUIStore } from '../../stores/uiStore';
import { useNodeStore, selectActiveNode } from '../../stores/nodeStore';

export function ReviewModeBar() {
  const { reviewMode, setReviewMode } = useUIStore();
  const activeNode = useNodeStore(selectActiveNode);

  if (!reviewMode || !activeNode) {
    return null;
  }

  const handleApprove = () => {
    setReviewMode(false);
  };

  const handleRequestChanges = () => {
    // Exit review mode to allow further chat
    setReviewMode(false);
  };

  return (
    <div className="bg-interactive/10 border-t border-interactive/30 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-interactive animate-pulse" />
          <div>
            <h3 className="text-sm font-medium text-text-primary">Review Mode</h3>
            <p className="text-xs text-text-secondary">
              Review the agent's work before proceeding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRequestChanges}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border-primary rounded hover:bg-surface-hover transition-colors"
          >
            Request Changes
          </button>
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 text-xs font-medium text-white bg-success rounded hover:bg-success/90 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
