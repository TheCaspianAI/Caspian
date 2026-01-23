/**
 * Parser for Claude Code agent output
 * Identifies tool calls, thinking blocks, and plain text
 *
 * IMPORTANT: This parser should only detect ACTUAL tool calls from Claude Code's
 * structured output, NOT mentions of tool names in natural language text.
 */

export interface ParsedToolCall {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  duration?: number;
  input?: string;
  output?: string;
}

export interface ParsedThinking {
  id: string;
  content: string;
}

export interface ParsedBlock {
  type: 'text' | 'tool_call' | 'tool_group' | 'thinking';
  content: string;
  toolCalls?: ParsedToolCall[];
  thinking?: ParsedThinking;
}

// Known Claude Code tool names
const TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'Task', 'WebFetch', 'WebSearch', 'TodoWrite',
  'AskUserQuestion', 'NotebookEdit'
];

/**
 * Detect ACTUAL tool calls - only matches structured tool output patterns,
 * not natural language mentions of tool names.
 *
 * Claude Code outputs tool usage in specific formats:
 * - "Read /path/to/file" (tool name at START of line followed by path)
 * - "Edit /path/to/file"
 * - "Bash: command here"
 * - Glob patterns like "Glob src/*.ts"
 */
function detectToolInLine(line: string): { tool: string; description: string } | null {
  const trimmed = line.trim();

  // Only match if line STARTS with a tool name followed by specific patterns
  for (const toolName of TOOL_NAMES) {
    // Pattern 1: "ToolName /path" or "ToolName ./path" (file operations)
    const fileToolPattern = new RegExp(`^${toolName}\\s+[./~]`, 'i');
    if (fileToolPattern.test(trimmed)) {
      return {
        tool: toolName,
        description: trimmed,
      };
    }

    // Pattern 2: "ToolName: something" (like "Bash: ls -la")
    const colonPattern = new RegExp(`^${toolName}:\\s+`, 'i');
    if (colonPattern.test(trimmed)) {
      return {
        tool: toolName,
        description: trimmed,
      };
    }

    // Pattern 3: "ToolName **/" or "ToolName *.ext" (glob patterns)
    const globPattern = new RegExp(`^${toolName}\\s+[*]`, 'i');
    if (globPattern.test(trimmed)) {
      return {
        tool: toolName,
        description: trimmed,
      };
    }
  }

  return null;
}

/**
 * Parse agent output into structured blocks
 */
export function parseAgentOutput(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');

  let currentTextBlock = '';
  let currentToolCalls: ParsedToolCall[] = [];
  let toolCallIdCounter = 0;

  const flushTextBlock = () => {
    if (currentTextBlock.trim()) {
      blocks.push({
        type: 'text',
        content: currentTextBlock.trim(),
      });
      currentTextBlock = '';
    }
  };

  const flushToolCalls = () => {
    if (currentToolCalls.length > 0) {
      blocks.push({
        type: 'tool_group',
        content: `${currentToolCalls.length} tool call${currentToolCalls.length > 1 ? 's' : ''}`,
        toolCalls: [...currentToolCalls],
      });
      currentToolCalls = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      if (currentTextBlock) {
        currentTextBlock += '\n';
      }
      continue;
    }

    // Detect tool usage - only matches actual structured tool output
    const toolDetection = detectToolInLine(trimmedLine);

    if (toolDetection) {
      // Flush any pending text block before tool calls
      flushTextBlock();

      currentToolCalls.push({
        id: `tool-${toolCallIdCounter++}`,
        name: toolDetection.tool,
        description: toolDetection.description,
        status: 'completed',
        startTime: Date.now(),
      });
    } else {
      // Flush tool calls if we have plain text after them
      if (currentToolCalls.length > 0) {
        flushToolCalls();
      }

      currentTextBlock += trimmedLine + '\n';
    }
  }

  // Flush remaining content
  flushToolCalls();
  flushTextBlock();

  return blocks;
}

/**
 * Check if content contains any actual tool-related activity
 * Only returns true for structured tool output, not natural language mentions
 */
export function hasToolActivity(content: string): boolean {
  const lines = content.split('\n');
  return lines.some(line => detectToolInLine(line) !== null);
}

/**
 * Extract a summary from agent output
 */
export function extractSummary(content: string, maxLength = 100): string {
  const lines = content.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || '';

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return firstLine.substring(0, maxLength - 3) + '...';
}
