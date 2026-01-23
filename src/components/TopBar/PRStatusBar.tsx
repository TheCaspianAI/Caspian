import type { PrInfo } from '../../types';

interface PRStatusBarProps {
  prInfo: PrInfo;
  onMerge: () => void;
  onDelete: () => void;
  isMerging?: boolean;
  isDeleting?: boolean;
}

export function PRStatusBar({ prInfo, onMerge, onDelete, isMerging, isDeleting }: PRStatusBarProps) {
  const statusText = getStatusText(prInfo);
  const statusColor = getStatusColor(prInfo);
  const canMerge = prInfo.mergeable === 'MERGEABLE' && prInfo.state === 'OPEN';
  const isMerged = prInfo.state === 'MERGED';

  return (
    <div className="flex items-center gap-3">
      {/* PR Badge - clickable link to GitHub */}
      <a
        href={prInfo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2 py-1 bg-surface-secondary hover:bg-surface-hover border border-border-primary rounded text-xs font-medium text-text-primary transition-colors"
        title={prInfo.title}
      >
        PR #{prInfo.number}
        {/* External link icon */}
        <svg className="w-3 h-3 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>

      {/* Status Text */}
      <span className={`text-xs font-medium ${statusColor}`}>
        {statusText}
      </span>

      {/* Action Button - Delete when merged, Merge when open */}
      {isMerged ? (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            isDeleting
              ? 'bg-surface-secondary text-text-tertiary cursor-not-allowed'
              : 'bg-error hover:bg-error/90 text-white'
          }`}
          title="Delete this node and its worktree"
        >
          {/* Trash icon */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {isDeleting ? 'Deleting...' : 'Delete Node'}
        </button>
      ) : (
        <button
          onClick={onMerge}
          disabled={!canMerge || isMerging}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            canMerge && !isMerging
              ? 'bg-success hover:bg-success/90 text-white'
              : 'bg-surface-secondary text-text-tertiary cursor-not-allowed'
          }`}
          title={!canMerge ? getDisabledReason(prInfo) : 'Merge this pull request'}
        >
          {/* Merge icon */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {isMerging ? 'Merging...' : 'Merge'}
        </button>
      )}
    </div>
  );
}

function getStatusText(prInfo: PrInfo): string {
  if (prInfo.state === 'MERGED') return 'Merged';
  if (prInfo.state === 'CLOSED') return 'Closed';
  if (prInfo.state !== 'OPEN') return prInfo.state;

  if (prInfo.mergeable === 'CONFLICTING') return 'Has conflicts';
  if (prInfo.mergeStateStatus === 'BLOCKED') return 'Checks pending';
  if (prInfo.mergeStateStatus === 'BEHIND') return 'Behind base';
  if (prInfo.mergeStateStatus === 'DIRTY') return 'Has conflicts';
  if (prInfo.mergeStateStatus === 'UNSTABLE') return 'Checks failing';
  if (prInfo.mergeable === 'MERGEABLE') return 'Ready to merge';
  if (prInfo.mergeable === 'UNKNOWN') return 'Checking...';

  return 'Open';
}

function getStatusColor(prInfo: PrInfo): string {
  if (prInfo.state === 'MERGED') return 'text-purple-400';
  if (prInfo.state === 'CLOSED') return 'text-error';

  if (prInfo.mergeable === 'CONFLICTING' || prInfo.mergeStateStatus === 'DIRTY') {
    return 'text-error';
  }
  if (prInfo.mergeStateStatus === 'BLOCKED' || prInfo.mergeStateStatus === 'UNSTABLE') {
    return 'text-warning';
  }
  if (prInfo.mergeable === 'MERGEABLE') {
    return 'text-success';
  }

  return 'text-text-secondary';
}

function getDisabledReason(prInfo: PrInfo): string {
  if (prInfo.state !== 'OPEN') return `PR is ${prInfo.state.toLowerCase()}`;
  if (prInfo.mergeable === 'CONFLICTING') return 'Resolve conflicts first';
  if (prInfo.mergeStateStatus === 'BLOCKED') return 'Waiting for checks to pass';
  if (prInfo.mergeStateStatus === 'UNSTABLE') return 'Some checks are failing';
  return 'Cannot merge';
}
