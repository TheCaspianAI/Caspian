import { useState } from 'react';

interface ToolCall {
  id: string;
  name: string;
  description?: string;
  command?: string;
  status: 'running' | 'completed' | 'error';
  result?: string;
  duration?: number;
  startTime: number;
}

interface ToolCallBlockProps {
  toolCalls: ToolCall[];
  isExpanded?: boolean;
}

export function ToolCallBlock({ toolCalls, isExpanded: initialExpanded = false }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const completedCount = toolCalls.filter(t => t.status === 'completed').length;
  const isAllComplete = completedCount === toolCalls.length;
  const hasError = toolCalls.some(t => t.status === 'error');

  // Calculate total duration
  const totalDuration = toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0);
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  // Summary line when collapsed
  const summaryText = `${toolCalls.length} tool call${toolCalls.length > 1 ? 's' : ''}`;

  return (
    <div className="my-2">
      {/* Collapsed summary or header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-body group"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-mono text-caption">{summaryText}</span>
        <span className="text-text-tertiary font-mono text-caption">&gt;_</span>
        {isAllComplete && totalDuration > 0 && (
          <span className="text-text-tertiary text-caption">{formatDuration(totalDuration)}</span>
        )}
        {!isAllComplete && !hasError && (
          <div className="w-1 h-1 bg-interactive rounded-full animate-pulse" />
        )}
        {hasError && (
          <span className="text-error text-caption">error</span>
        )}
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-fast ease-standard ${
          isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-2 pl-5 border-l border-border-secondary">
          {toolCalls.map((tool) => (
            <div key={tool.id} className="text-body">
              {/* Tool header */}
              <div className="flex items-center gap-2">
                <span className="text-text-tertiary font-mono text-caption">&gt;_</span>
                <span className="text-text-primary">{tool.description || tool.name}</span>
                {tool.status === 'running' && (
                  <div className="w-1 h-1 bg-interactive rounded-full animate-pulse" />
                )}
                {tool.status === 'completed' && tool.duration && (
                  <span className="text-text-tertiary text-caption">{formatDuration(tool.duration)}</span>
                )}
                {tool.status === 'error' && (
                  <span className="text-error text-caption">failed</span>
                )}
              </div>

              {/* Command preview */}
              {tool.command && (
                <div className="mt-1 pl-5">
                  <code className="text-caption text-text-tertiary font-mono break-all">
                    {tool.command.length > 80 ? `${tool.command.slice(0, 80)}...` : tool.command}
                  </code>
                </div>
              )}

              {/* Result preview */}
              {tool.result && tool.status === 'completed' && (
                <div className="mt-1 pl-5 text-text-secondary text-caption">
                  {tool.result.length > 100 ? `${tool.result.slice(0, 100)}...` : tool.result}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metadata row when collapsed and complete */}
      {!isExpanded && isAllComplete && (
        <div className="flex items-center gap-3 mt-1 pl-5 text-text-tertiary">
          {totalDuration > 0 && (
            <span className="text-caption">{formatDuration(totalDuration)}</span>
          )}
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              // Copy functionality
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Helper to parse tool calls from Claude Code output
export function parseToolCalls(output: string): ToolCall[] {
  // This is a simplified parser - Claude Code outputs JSON for tool calls
  // In a real implementation, we'd parse the structured output
  const tools: ToolCall[] = [];

  // Look for tool call patterns in the output
  const toolCallRegex = /\[Tool: (\w+)\](.*?)(?=\[Tool:|$)/gs;
  let match;

  while ((match = toolCallRegex.exec(output)) !== null) {
    tools.push({
      id: `tool-${tools.length}`,
      name: match[1],
      description: match[1],
      command: match[2]?.trim(),
      status: 'completed',
      startTime: Date.now(),
    });
  }

  return tools;
}
