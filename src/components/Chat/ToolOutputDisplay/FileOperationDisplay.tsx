import { useState } from 'react';
import type { ParsedToolOutput } from '../../../types';
import { DiffViewer } from './DiffViewer';
import { getFileName } from '../../../utils/diffParser';

interface FileOperationDisplayProps {
  parsed: ParsedToolOutput;
  toolName: string;
  duration?: number;
}

export function FileOperationDisplay({ parsed, toolName, duration }: FileOperationDisplayProps) {
  const [showDiff, setShowDiff] = useState(false);

  const fileName = parsed.filePath ? getFileName(parsed.filePath) : 'file';
  const hasEditDiff = toolName === 'Edit' && parsed.diff;

  return (
    <div className="mt-1">
      {/* File info line */}
      <div className="flex items-center gap-2 text-caption">
        {/* File icon based on extension */}
        <FileIcon extension={parsed.fileExtension} />

        {/* File path (truncated) */}
        <span className="text-text-tertiary font-mono truncate max-w-[200px] 2xl:max-w-[280px] 3xl:max-w-[350px]" title={parsed.filePath}>
          {fileName}
        </span>

        {/* Stats */}
        {toolName === 'Edit' && parsed.diff && (
          <span className="flex items-center gap-1">
            <span className="text-success">+{parsed.additions || 0}</span>
            <span className="text-error">-{parsed.deletions || 0}</span>
          </span>
        )}

        {(toolName === 'Read' || toolName === 'Write') && parsed.lineCount && (
          <span className="text-text-quaternary">{parsed.lineCount} lines</span>
        )}

        {/* Duration */}
        {duration && (
          <span className="text-text-quaternary ml-auto">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* Diff toggle for Edit operations */}
      {hasEditDiff && (
        <div className="mt-1">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1 text-caption text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${showDiff ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showDiff ? 'Hide diff' : 'Show diff'}
          </button>

          {showDiff && parsed.diff && (
            <DiffViewer diff={parsed.diff} maxLines={15} />
          )}
        </div>
      )}
    </div>
  );
}

function FileIcon({ extension }: { extension?: string }) {
  // Color based on extension
  const getColor = () => {
    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'text-blue-400';
      case 'js':
      case 'jsx':
        return 'text-yellow-400';
      case 'json':
        return 'text-yellow-500';
      case 'css':
      case 'scss':
        return 'text-pink-400';
      case 'html':
        return 'text-orange-400';
      case 'md':
        return 'text-gray-400';
      case 'py':
        return 'text-green-400';
      case 'rs':
        return 'text-orange-500';
      case 'go':
        return 'text-cyan-400';
      default:
        return 'text-text-tertiary';
    }
  };

  return (
    <svg className={`w-3 h-3 ${getColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
