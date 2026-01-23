// Status type for node display
export type NodeStatusType = 'idle' | 'running' | 'completed' | 'error' | 'pending' | 'preparing' | 'worktree_failed';

interface NodeStatusProps {
  status: NodeStatusType;
  worktreeProgress?: {
    progress: number;
    attempt: number;
    maxAttempts: number;
  };
}

/**
 * NodeStatus - Status indicator chip with animations
 *
 * Displays the current status of a node with appropriate colors and animations.
 */
export function NodeStatus({ status, worktreeProgress }: NodeStatusProps) {
  const baseChipClass = "inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded border";

  switch (status) {
    case 'preparing':
      return (
        <span className={`${baseChipClass} text-[rgba(255,122,237,0.75)] bg-[rgba(255,122,237,0.10)] border-[rgba(255,122,237,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(255,122,237,0.75)] animate-pulse" />
          {worktreeProgress && worktreeProgress.attempt > 1
            ? `Retry ${worktreeProgress.attempt}/${worktreeProgress.maxAttempts}`
            : 'Preparing'}
        </span>
      );
    case 'worktree_failed':
      return (
        <span className={`${baseChipClass} text-[rgba(248,113,113,0.75)] bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(248,113,113,0.75)]" />
          Setup Failed
        </span>
      );
    case 'running':
      return (
        <span className={`${baseChipClass} text-[rgba(251,191,36,0.80)] bg-[rgba(251,191,36,0.10)] border-[rgba(251,191,36,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(251,191,36,0.80)] animate-pulse" />
          Running
        </span>
      );
    case 'completed':
      return (
        <span className={`${baseChipClass} text-[rgba(80,200,120,0.75)] bg-[rgba(80,200,120,0.10)] border-[rgba(80,200,120,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(80,200,120,0.75)]" />
          Completed
        </span>
      );
    case 'error':
      return (
        <span className={`${baseChipClass} text-[rgba(248,113,113,0.75)] bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(248,113,113,0.75)]" />
          Error
        </span>
      );
    case 'pending':
      return (
        <span className={`${baseChipClass} text-[rgba(255,122,237,0.75)] bg-[rgba(255,122,237,0.10)] border-[rgba(255,122,237,0.18)]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[rgba(255,122,237,0.75)]" />
          Pending
        </span>
      );
    default:
      return (
        <span className={`${baseChipClass} text-white/[0.45] bg-white/[0.04] border-white/[0.08]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/[0.45]" />
          Idle
        </span>
      );
  }
}
