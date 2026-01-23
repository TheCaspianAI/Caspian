import { useState } from 'react';
import type { ParsedToolOutput } from '../../../types';

interface TaskProgressDisplayProps {
  parsed: ParsedToolOutput;
  description?: string;
  duration?: number;
}

export function TaskProgressDisplay({ parsed, description, duration }: TaskProgressDisplayProps) {
  const [showOutput, setShowOutput] = useState(false);

  const hasProgress = parsed.taskProgress && parsed.taskProgress.total > 0;
  const progressPercent = hasProgress
    ? Math.round((parsed.taskProgress!.completed / parsed.taskProgress!.total) * 100)
    : 0;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 text-caption">
        {/* Task icon */}
        <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>

        {/* Description */}
        {description && (
          <span className="text-text-tertiary truncate max-w-[180px] 2xl:max-w-[250px] 3xl:max-w-[320px]" title={description}>
            {description}
          </span>
        )}

        {/* Progress */}
        {hasProgress && (
          <span className="text-text-secondary">
            {parsed.taskProgress!.completed}/{parsed.taskProgress!.total}
          </span>
        )}

        {/* Nested tool count */}
        {parsed.nestedToolCount && (
          <span className="text-text-quaternary">
            {parsed.nestedToolCount} tool{parsed.nestedToolCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Duration */}
        {duration && (
          <span className="text-text-quaternary ml-auto">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {hasProgress && (
        <div className="mt-1 ml-5">
          <div className="h-1 bg-surface-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-interactive transition-all duration-medium ease-standard"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Output toggle */}
      {parsed.raw && parsed.raw.length > 0 && (
        <div className="mt-1 ml-5">
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="flex items-center gap-1 text-caption text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${showOutput ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showOutput ? 'Hide output' : 'Show output'}
          </button>

          {showOutput && (
            <div className="mt-1 p-2 bg-surface-secondary/50 rounded border border-border-secondary font-mono text-caption text-text-tertiary max-h-32 overflow-y-auto whitespace-pre-wrap">
              {parsed.raw.slice(0, 2000)}
              {parsed.raw.length > 2000 && '... (truncated)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
