import { useMemo } from 'react';
import type { LiveToolCall } from '../../../types';
import { parseToolOutput } from '../../../utils/toolOutputParser';
import { FileOperationDisplay } from './FileOperationDisplay';
import { GitOperationDisplay } from './GitOperationDisplay';
import { TaskProgressDisplay } from './TaskProgressDisplay';

interface ToolOutputDisplayProps {
  tool: LiveToolCall;
}

/**
 * Router component that displays tool output based on tool type
 * Only shows output for completed tools with output
 */
export function ToolOutputDisplay({ tool }: ToolOutputDisplayProps) {
  // Only display for completed tools with output
  if (tool.status !== 'completed' || !tool.output) {
    return null;
  }

  // Parse the tool output
  const parsed = useMemo(() => parseToolOutput(tool), [tool]);

  // Route to appropriate display component
  switch (parsed.type) {
    case 'file':
      return (
        <FileOperationDisplay
          parsed={parsed}
          toolName={tool.name}
          duration={tool.duration}
        />
      );

    case 'git':
      return (
        <GitOperationDisplay
          parsed={parsed}
          duration={tool.duration}
        />
      );

    case 'task':
      return (
        <TaskProgressDisplay
          parsed={parsed}
          description={tool.input?.description as string}
          duration={tool.duration}
        />
      );

    case 'search':
      // For search, show a simple summary
      if (parsed.fileMatches) {
        return (
          <div className="mt-1 text-caption text-text-tertiary">
            {parsed.fileMatches} file{parsed.fileMatches !== 1 ? 's' : ''} found
          </div>
        );
      }
      return null;

    case 'bash':
      // For non-git bash, show truncated output preview if interesting
      if (parsed.raw && parsed.raw.length > 0 && parsed.raw.length < 200) {
        return (
          <div className="mt-1 text-caption text-text-quaternary font-mono truncate max-w-[300px] 2xl:max-w-[400px] 3xl:max-w-[500px]">
            {parsed.raw.split('\n')[0]}
          </div>
        );
      }
      return null;

    default:
      return null;
  }
}

export { FileOperationDisplay } from './FileOperationDisplay';
export { GitOperationDisplay } from './GitOperationDisplay';
export { TaskProgressDisplay } from './TaskProgressDisplay';
export { DiffViewer } from './DiffViewer';
