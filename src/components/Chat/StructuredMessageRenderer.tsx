import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatedTextBlock, StaticTextBlock } from './AnimatedTextBlock';
import { ToolOutputDisplay } from './ToolOutputDisplay';
import type { LiveToolCall, LiveBlock, ToolStatus, BlockStreamingState } from '../../types';

interface StructuredMessageRendererProps {
  blocks: LiveBlock[];
  toolCalls: LiveToolCall[];
  isAgentRunning?: boolean;
  isStreaming?: boolean;
  isLiveData?: boolean;  // Whether this is live streaming data vs persisted historical data
}

export function StructuredMessageRenderer({
  blocks,
  toolCalls,
  isAgentRunning = false,
  isStreaming = false,
  isLiveData = false,
}: StructuredMessageRendererProps) {
  // Create stable keys for memoization based on actual content, not array references
  // This prevents unnecessary recalculations when arrays have same content but different references
  const blocksKey = useMemo(
    () => blocks.map(b => `${b.id}:${b.streamingState || ''}`).join('|'),
    [blocks]
  );
  const toolsKey = useMemo(
    () => toolCalls.map(t => `${t.id}:${t.status}`).join('|'),
    [toolCalls]
  );

  // Group consecutive tool calls together - use stable keys as dependencies
  const groupedContent = useMemo(() => {
    return groupBlocksAndTools(blocks, toolCalls);
  }, [blocksKey, toolsKey, blocks, toolCalls]);

  // Calculate summary stats - use stable key as dependency
  const summary = useMemo(() => computeSummary(toolCalls), [toolsKey, toolCalls]);

  return (
    <div className="space-y-2">
      {/* Summary header when there are tool calls */}
      {summary.total_tool_calls > 0 && (
        <MessageHeader summary={summary} isRunning={isAgentRunning} />
      )}

      {groupedContent.map((item, index) => (
        <GroupedBlockRenderer
          key={index}
          item={item}
          isAgentRunning={isAgentRunning}
          isLatest={index === groupedContent.length - 1}
          isStreaming={isStreaming && index === groupedContent.length - 1}
          isLiveData={isLiveData}
        />
      ))}
    </div>
  );
}

interface MessageHeaderProps {
  summary: {
    total_tool_calls: number;
    completed_tool_calls: number;
    running_tool_calls: number;
    error_tool_calls: number;
    total_duration_ms: number;
  };
  isRunning: boolean;
}

function MessageHeader({ summary, isRunning }: MessageHeaderProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex items-center gap-2 text-[12px] text-white/[0.45] mb-1.5">
      <span>
        {summary.total_tool_calls} tool call{summary.total_tool_calls !== 1 ? 's' : ''}
      </span>

      {isRunning && summary.running_tool_calls > 0 && (
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-interactive rounded-full animate-pulse" />
          {summary.running_tool_calls} running
        </span>
      )}

      {summary.error_tool_calls > 0 && (
        <span className="text-status-error">
          {summary.error_tool_calls} failed
        </span>
      )}

      {summary.completed_tool_calls === summary.total_tool_calls &&
        summary.total_duration_ms > 0 && (
          <span className="text-text-quaternary">
            {formatDuration(summary.total_duration_ms)}
          </span>
        )}
    </div>
  );
}

type GroupedItem =
  | { type: 'text'; content: string; streamingState?: BlockStreamingState; blockId?: string }
  | { type: 'tool_group'; toolCalls: LiveToolCall[] };

interface GroupedBlockRendererProps {
  item: GroupedItem;
  isAgentRunning: boolean;
  isLatest: boolean;
  isStreaming: boolean;
  isLiveData: boolean;
}

function GroupedBlockRenderer({
  item,
  isAgentRunning,
  isLatest,
  isStreaming,
  isLiveData,
}: GroupedBlockRendererProps) {
  if (item.type === 'text') {
    // For persisted/historical data, always use static rendering
    if (!isLiveData) {
      return <StaticTextBlock content={item.content} />;
    }

    // For live data, always use AnimatedTextBlock - it handles its own completion
    // The isStreaming prop tells it whether more content might be appended
    const isBlockStreaming = isStreaming || item.streamingState === 'streaming';

    return (
      <div className="animate-block-enter">
        <AnimatedTextBlock
          content={item.content}
          blockId={item.blockId}
          isStreaming={isBlockStreaming}
          speed="fast"
        />
      </div>
    );
  }

  if (item.type === 'tool_group') {
    return (
      <ToolCallGroup
        toolCalls={item.toolCalls}
        isRunning={isAgentRunning && isLatest}
      />
    );
  }

  return null;
}

interface ToolCallGroupProps {
  toolCalls: LiveToolCall[];
  isRunning: boolean;
}

function ToolCallGroup({ toolCalls, isRunning }: ToolCallGroupProps) {
  // Auto-expand while running, collapse when done
  const [isExpanded, setIsExpanded] = useState(isRunning);
  // Track if user has manually interacted
  const hasUserInteractedRef = useRef(false);
  // Track collapse timer for cleanup
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single consolidated effect for expand/collapse behavior
  // Prevents race conditions from having two separate effects
  useEffect(() => {
    // Clear any pending collapse timer first
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    // Skip automatic behavior if user has manually interacted
    if (hasUserInteractedRef.current) return;

    if (isRunning) {
      // Auto-expand when running, reset user interaction flag
      setIsExpanded(true);
      hasUserInteractedRef.current = false;
    } else if (isExpanded) {
      // Auto-collapse after delay so user can see results
      collapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 1500);
    }

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [isRunning, isExpanded]);

  const handleToggle = () => {
    hasUserInteractedRef.current = true; // Mark as user-interacted
    setIsExpanded(!isExpanded);
  };

  // Calculate stats
  const completedCount = toolCalls.filter((t) => t.status === 'completed').length;
  const runningCount = toolCalls.filter((t) => t.status === 'running').length;
  const totalDuration = toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="my-1.5 p-2.5 rounded-[10px] bg-white/[0.04] border border-white/[0.06]">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-white/[0.55] hover:text-white/[0.70] transition-colors group w-full text-left"
        style={{ fontSize: '11px', lineHeight: '1.4' }}
      >
        <svg
          className={`w-2.5 h-2.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <span>
          {toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}
        </span>

        {/* Show running indicator based on actual tool statuses, not just isRunning prop */}
        {runningCount > 0 && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1.5 h-1.5 bg-interactive rounded-full animate-pulse" />
            <span className="text-interactive/70">{runningCount} running</span>
          </div>
        )}

        {completedCount === toolCalls.length && totalDuration > 0 && (
          <span className="text-white/[0.38]">{formatDuration(totalDuration)}</span>
        )}
      </button>

      {/* Expanded content */}
      <div
        className={`transition-all duration-fast ease-standard scrollbar-overlay ${
          isExpanded ? 'max-h-[600px] opacity-100 mt-1.5 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="space-y-1">
          {toolCalls.map((tool) => (
            <ToolCallItem key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToolCallItemProps {
  tool: LiveToolCall;
}

function ToolCallItem({ tool }: ToolCallItemProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Determine if this is a path/code type tool
  const isPathTool = ['Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(tool.name);

  return (
    <div className="py-1 px-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      {/* Compact metadata row */}
      <div className="flex items-center gap-1.5" style={{ fontSize: '11px', lineHeight: '1.3' }}>
        <span className="text-white/[0.38] flex-shrink-0">
          <ToolIcon name={tool.name} />
        </span>
        <span className="font-medium text-white/[0.55]">{tool.name}</span>
        <StatusIndicator status={tool.status} isError={tool.isError} />
        {tool.status === 'completed' && tool.duration && (
          <span className="text-white/[0.38] ml-auto">{formatDuration(tool.duration)}</span>
        )}
      </div>
      {/* Path/code block or description */}
      {isPathTool ? (
        <PathCodeBlock tool={tool} />
      ) : (
        <ToolDescription tool={tool} />
      )}
      <ToolOutputDisplay tool={tool} />
    </div>
  );
}

function PathCodeBlock({ tool }: { tool: LiveToolCall }) {
  const input = tool.input || {};
  const path = (input.file_path as string) || (input.path as string) || (input.pattern as string) || '';

  if (!path) return <ToolDescription tool={tool} />;

  return (
    <div
      className="mt-1.5 px-2 py-1.5 rounded-lg font-mono bg-white/[0.06] border border-white/[0.08] overflow-x-auto scrollbar-overlay"
      style={{ fontSize: '11px', lineHeight: '1.4' }}
    >
      <span className="text-white/[0.82] whitespace-nowrap">{path}</span>
    </div>
  );
}

function StatusIndicator({ status, isError }: { status: ToolStatus; isError: boolean }) {
  if (status === 'running') {
    return <div className="w-1.5 h-1.5 bg-interactive rounded-full animate-running-pulse" />;
  }
  if (status === 'error' || isError) {
    return (
      <svg className="w-3 h-3 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'completed') {
    return (
      <svg className="w-3 h-3 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return null;
}

function ToolDescription({ tool }: { tool: LiveToolCall }) {
  const input = tool.input || {};

  const getDescription = () => {
    switch (tool.name) {
      case 'Read': {
        const path = input.file_path as string || 'file';
        return path;
      }
      case 'Write':
      case 'Edit': {
        const path = input.file_path as string || 'file';
        return path;
      }
      case 'Bash': {
        const cmd = input.command as string || '';
        const truncated = cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd;
        return truncated;
      }
      case 'Glob': {
        const pattern = input.pattern as string || '*';
        return pattern;
      }
      case 'Grep': {
        const pattern = input.pattern as string || 'pattern';
        const path = input.path as string;
        return path ? `${pattern} in ${path}` : pattern;
      }
      case 'Task': {
        const desc = input.description as string || 'task';
        return desc;
      }
      case 'WebFetch': {
        const url = input.url as string || 'url';
        return url;
      }
      case 'TodoWrite':
        return 'Update todo list';
      case 'AskUserQuestion':
        return 'Ask user question';
      default:
        return JSON.stringify(input).slice(0, 50);
    }
  };

  const description = getDescription();

  return (
    <p className="text-white/[0.45] mt-0.5 font-mono overflow-x-auto whitespace-nowrap scrollbar-overlay" style={{ fontSize: '11px' }}>
      <span className="animate-tool-input inline-block">{description}</span>
    </p>
  );
}

function ToolIcon({ name }: { name: string }) {
  switch (name.toLowerCase()) {
    case 'read':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'write':
    case 'edit':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      );
    case 'bash':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case 'glob':
    case 'grep':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case 'task':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

// Helper functions

function groupBlocksAndTools(blocks: LiveBlock[], toolCalls: LiveToolCall[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let currentToolGroup: LiveToolCall[] = [];

  // Create a map of tool calls by ID for quick lookup
  const toolCallMap = new Map(toolCalls.map((tc) => [tc.id, tc]));

  for (const block of blocks) {
    // Skip thinking blocks - we don't render them
    if (block.type === 'thinking') {
      continue;
    }

    if (block.type === 'tool_use' && block.toolCall) {
      // Add to current tool group
      const fullToolCall = toolCallMap.get(block.toolCall.id) || block.toolCall;
      currentToolGroup.push(fullToolCall);
    } else if (block.type === 'text') {
      // Flush any pending tool group
      if (currentToolGroup.length > 0) {
        result.push({ type: 'tool_group', toolCalls: [...currentToolGroup] });
        currentToolGroup = [];
      }
      result.push({
        type: 'text',
        content: block.content,
        streamingState: block.streamingState,
        blockId: block.id,
      });
    }
  }

  // Flush remaining tool group
  if (currentToolGroup.length > 0) {
    result.push({ type: 'tool_group', toolCalls: currentToolGroup });
  }

  // If no blocks but we have tool calls, show them
  if (result.length === 0 && toolCalls.length > 0) {
    result.push({ type: 'tool_group', toolCalls });
  }

  return result;
}

function computeSummary(toolCalls: LiveToolCall[]) {
  return {
    total_tool_calls: toolCalls.length,
    completed_tool_calls: toolCalls.filter((t) => t.status === 'completed').length,
    running_tool_calls: toolCalls.filter((t) => t.status === 'running').length,
    error_tool_calls: toolCalls.filter((t) => t.status === 'error' || t.isError).length,
    total_duration_ms: toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0),
    has_thinking: false, // Will be computed from blocks
  };
}
