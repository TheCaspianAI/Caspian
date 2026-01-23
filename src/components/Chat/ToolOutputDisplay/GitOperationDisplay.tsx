import type { ParsedToolOutput, GitOperationType } from '../../../types';

interface GitOperationDisplayProps {
  parsed: ParsedToolOutput;
  duration?: number;
}

export function GitOperationDisplay({ parsed, duration }: GitOperationDisplayProps) {
  const getOperationLabel = (op: GitOperationType): string => {
    switch (op) {
      case 'commit': return 'Committed';
      case 'checkout': return 'Checked out';
      case 'branch-create': return 'Branch created';
      case 'push': return 'Pushed';
      case 'pull': return 'Pulled';
      case 'merge': return 'Merged';
      case 'status': return 'Status';
      case 'diff': return 'Diff';
      case 'log': return 'Log';
      default: return 'Git';
    }
  };

  const gitOp = parsed.gitOperation || 'other';

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 text-caption">
        {/* Git icon */}
        <GitIcon operation={gitOp} />

        {/* Operation label */}
        <span className="text-text-secondary font-medium">
          {getOperationLabel(gitOp)}
        </span>

        {/* Operation-specific details */}
        {gitOp === 'commit' && (
          <>
            {parsed.commitMessage && (
              <span className="text-text-tertiary truncate max-w-[200px] 2xl:max-w-[280px] 3xl:max-w-[350px]" title={parsed.commitMessage}>
                "{parsed.commitMessage}"
              </span>
            )}
          </>
        )}

        {(gitOp === 'branch-create' || gitOp === 'checkout') && parsed.branchName && (
          <span className="text-interactive font-mono">{parsed.branchName}</span>
        )}

        {gitOp === 'push' && parsed.branchName && (
          <span className="text-text-tertiary">
            → <span className="font-mono">{parsed.branchName}</span>
          </span>
        )}

        {/* Duration */}
        {duration && (
          <span className="text-text-quaternary ml-auto">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* Commit stats line */}
      {gitOp === 'commit' && (parsed.commitHash || parsed.filesChanged) && (
        <div className="flex items-center gap-2 text-caption mt-0.5 pl-5">
          {parsed.commitHash && (
            <span className="font-mono text-text-tertiary">
              {parsed.commitHash.slice(0, 7)}
            </span>
          )}
          {parsed.filesChanged !== undefined && (
            <span className="text-text-quaternary">
              {parsed.filesChanged} file{parsed.filesChanged !== 1 ? 's' : ''}
            </span>
          )}
          {(parsed.additions !== undefined || parsed.deletions !== undefined) && (
            <span className="flex items-center gap-1">
              {parsed.additions !== undefined && (
                <span className="text-success">+{parsed.additions}</span>
              )}
              {parsed.deletions !== undefined && (
                <span className="text-error">-{parsed.deletions}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function GitIcon({ operation }: { operation: GitOperationType }) {
  // Different icons for different git operations
  switch (operation) {
    case 'commit':
      return (
        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'branch-create':
      return (
        <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      );
    case 'push':
      return (
        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      );
    case 'pull':
      return (
        <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 13l5 5m0 0l5-5m-5 5V6" />
        </svg>
      );
    case 'merge':
      return (
        <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7H6a2 2 0 00-2 2v6a2 2 0 002 2h2" />
        </svg>
      );
    default:
      // Default git icon
      return (
        <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21.62 11.11l-8.73-8.73a1.32 1.32 0 00-1.87 0L9.14 4.26l2.36 2.36a1.56 1.56 0 012 2l2.28 2.28a1.56 1.56 0 11-.94.94l-2.13-2.13v5.6a1.56 1.56 0 11-1.28 0V9.53a1.56 1.56 0 01-.85-2.05L8.25 5.15 2.38 11a1.32 1.32 0 000 1.87l8.73 8.73a1.32 1.32 0 001.87 0l8.64-8.64a1.32 1.32 0 000-1.87z" />
        </svg>
      );
  }
}
