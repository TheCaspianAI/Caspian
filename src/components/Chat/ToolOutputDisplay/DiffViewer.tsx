import { useState } from 'react';
import type { ParsedDiff, DiffLine } from '../../../types';

interface DiffViewerProps {
  diff: ParsedDiff;
  maxLines?: number;
  defaultExpanded?: boolean;
}

export function DiffViewer({ diff, maxLines = 10, defaultExpanded = false }: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Flatten all lines from all files for display
  const allLines: DiffLine[] = diff.files.flatMap(f =>
    f.lines.filter(l => l.type !== 'header')
  );

  const displayLines = isExpanded ? allLines : allLines.slice(0, maxLines);
  const hasMore = allLines.length > maxLines;

  if (allLines.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 rounded border border-border-secondary overflow-hidden">
      <div className="bg-surface-secondary/50 font-mono text-caption leading-relaxed max-h-48 overflow-y-auto">
        {displayLines.map((line, idx) => (
          <DiffLineRenderer key={idx} line={line} />
        ))}

        {!isExpanded && hasMore && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full px-2 py-1 text-caption text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/50 transition-colors text-left"
          >
            ... {allLines.length - maxLines} more lines
          </button>
        )}
      </div>

      {isExpanded && hasMore && (
        <button
          onClick={() => setIsExpanded(false)}
          className="w-full px-2 py-0.5 text-caption text-text-tertiary hover:text-text-secondary bg-surface-secondary/30 border-t border-border-secondary transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function DiffLineRenderer({ line }: { line: DiffLine }) {
  let className = 'px-2 py-px whitespace-pre';
  let prefix = ' ';

  switch (line.type) {
    case 'add':
      className += ' bg-success/10 text-success';
      prefix = '+';
      break;
    case 'remove':
      className += ' bg-error/10 text-error';
      prefix = '-';
      break;
    case 'hunk':
      className += ' bg-interactive/10 text-interactive';
      return (
        <div className={className}>
          {line.content}
        </div>
      );
    case 'binary':
      className += ' bg-warning/10 text-warning italic';
      return (
        <div className={className}>
          {line.content}
        </div>
      );
    default:
      className += ' text-text-tertiary';
  }

  return (
    <div className={className}>
      <span className="select-none opacity-50 mr-1">{prefix}</span>
      {line.content}
    </div>
  );
}
