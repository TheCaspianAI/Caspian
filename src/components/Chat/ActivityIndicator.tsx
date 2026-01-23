import { useMemo } from 'react';
import type { LiveToolCall } from '../../types';

interface ActivityIndicatorProps {
  isVisible: boolean;
  toolCalls?: LiveToolCall[];
  className?: string;
}

// Map tool names to user-friendly activity phrases
function getActivityPhrase(toolCalls: LiveToolCall[]): string {
  // Get currently running tools
  const runningTools = toolCalls.filter(tc => tc.status === 'running');

  if (runningTools.length === 0) {
    return 'Thinking';
  }

  // If multiple tools running, show generic message
  if (runningTools.length > 1) {
    return `Running ${runningTools.length} tasks`;
  }

  // Single tool running - show contextual phrase
  const toolName = runningTools[0].name;

  switch (toolName) {
    // File reading
    case 'Read':
      return 'Reading files';

    // File writing/editing
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return 'Writing code';

    // Search operations
    case 'Grep':
    case 'Glob':
      return 'Searching codebase';

    // Command execution
    case 'Bash':
      return 'Running command';

    // Web operations
    case 'WebFetch':
    case 'WebSearch':
      return 'Fetching from web';

    // Task/Agent spawning
    case 'Task':
      return 'Spawning agent';

    // Thinking/planning
    case 'TodoWrite':
      return 'Planning tasks';

    // Questions
    case 'AskUserQuestion':
      return 'Preparing question';

    // Default for unknown tools
    default:
      return 'Working';
  }
}

/**
 * Unified activity indicator shown while the agent is working.
 * Displays contextual phrases based on current tool activity.
 * This is the single indicator for all agent activity states.
 */
export function ActivityIndicator({
  isVisible,
  toolCalls = [],
  className = ''
}: ActivityIndicatorProps) {
  const phrase = useMemo(() => getActivityPhrase(toolCalls), [toolCalls]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        flex items-center py-1.5 mb-2
        animate-content-enter
        ${className}
      `}
    >
      {/* Activity phrase with gradient animation */}
      <span className="thinking-gradient-text text-sm font-medium">
        {phrase}
      </span>
    </div>
  );
}
