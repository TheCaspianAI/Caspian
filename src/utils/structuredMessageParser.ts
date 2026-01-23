import type { Message, LiveBlock, LiveToolCall, ToolStatus, BlockType } from '../types';
import { stripContextMarkers } from './contextUtils';

/**
 * Represents the parsed JSON structure from Claude Code's stream-json output.
 * These types mirror the backend json_types.rs definitions.
 */

interface ContentBlockThinking {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

interface ContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ContentBlockText {
  type: 'text';
  text: string;
}

type ContentBlock = ContentBlockThinking | ContentBlockToolUse | ContentBlockText;

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface AssistantMessage {
  id: string;
  content: ContentBlock[];
}

interface UserMessage {
  content: ToolResultContent[];
}

interface ClaudeEventAssistant {
  type: 'assistant';
  message: AssistantMessage;
}

interface ClaudeEventUser {
  type: 'user';
  message: UserMessage;
}

interface ClaudeEventResult {
  type: 'result';
  duration_ms?: number;
  num_turns?: number;
  is_error?: boolean;
  result?: string;
}

interface ClaudeEventSystem {
  type: 'system';
  subtype?: string;
  session_id?: string;
  model?: string;
  tools?: string[];
}

type ClaudeEvent = ClaudeEventAssistant | ClaudeEventUser | ClaudeEventResult | ClaudeEventSystem;

/**
 * Parse a single line of stored JSON content from the database.
 */
function parseClaudeEvent(jsonStr: string): ClaudeEvent | null {
  try {
    const trimmed = jsonStr.trim();
    if (!trimmed.startsWith('{')) return null;
    return JSON.parse(trimmed) as ClaudeEvent;
  } catch {
    return null;
  }
}

/**
 * Generates a human-readable description for a tool call.
 */
function generateToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return `Reading ${input.file_path || 'file'}`;
    case 'Write':
      return `Writing to ${input.file_path || 'file'}`;
    case 'Edit':
      return `Editing ${input.file_path || 'file'}`;
    case 'Bash':
      const cmd = String(input.command || '');
      return cmd.length > 50 ? `Running: ${cmd.substring(0, 50)}...` : `Running: ${cmd}`;
    case 'Glob':
      return `Searching for ${input.pattern || 'files'}`;
    case 'Grep':
      return `Searching for "${input.pattern || ''}"`;
    case 'Task':
      return `${input.description || 'Running task'}`;
    case 'TodoWrite':
      return 'Updating todo list';
    case 'WebFetch':
      return `Fetching ${input.url || 'URL'}`;
    case 'WebSearch':
      return `Searching: ${input.query || ''}`;
    default:
      return toolName;
  }
}

/**
 * Parse stored structured messages from the database and convert them to
 * LiveBlock[] and LiveToolCall[] format for rendering.
 *
 * This function handles messages that were stored with metadata.structured = true,
 * which contain the raw JSON from Claude Code's stream-json output.
 */
export function parseStoredStructuredMessages(messages: Message[]): {
  blocks: LiveBlock[];
  toolCalls: LiveToolCall[];
} {
  const blocks: LiveBlock[] = [];
  const toolCalls: LiveToolCall[] = [];

  // Map to track tool calls by ID for matching tool_use with tool_result
  const toolCallMap = new Map<string, LiveToolCall>();

  // Filter to only structured messages and sort by timestamp
  // Include 'complete' events even though they're marked internal - we need them to finalize tool statuses
  const structuredMessages = messages
    .filter(m => {
      if (m.metadata?.structured !== true) return false;
      // Allow 'complete' events through even if marked internal
      if (m.metadata?.event_type === 'complete') return true;
      // Filter out other internal messages
      return m.metadata?.internal !== true;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (const msg of structuredMessages) {
    const event = parseClaudeEvent(msg.content);
    if (!event) continue;

    switch (event.type) {
      case 'assistant': {
        const messageId = event.message.id;

        for (const block of event.message.content) {
          if (block.type === 'thinking') {
            blocks.push({
              id: `thinking-${messageId}-${blocks.length}`,
              type: 'thinking' as BlockType,
              content: block.thinking,
              messageId,
            });
          } else if (block.type === 'tool_use') {
            // Create the tool call
            const toolCall: LiveToolCall = {
              id: block.id,
              name: block.name,
              input: block.input,
              status: 'running' as ToolStatus, // Will be updated when tool_result is found
              startedAt: new Date(msg.created_at).getTime(),
              isError: false,
              messageId,
            };

            // Add description to input for display
            toolCall.input._description = generateToolDescription(block.name, block.input);

            toolCallMap.set(block.id, toolCall);
            toolCalls.push(toolCall);

            // Add as a block too
            blocks.push({
              id: `tool-${block.id}`,
              type: 'tool_use' as BlockType,
              content: generateToolDescription(block.name, block.input),
              messageId,
              toolCall,
            });
          } else if (block.type === 'text') {
            // Strip CONTEXT markers from text content before adding block
            const cleanedText = stripContextMarkers(block.text);
            if (cleanedText) {
              blocks.push({
                id: `text-${messageId}-${blocks.length}`,
                type: 'text' as BlockType,
                content: cleanedText,
                messageId,
              });
            }
          }
        }
        break;
      }

      case 'user': {
        // User events contain tool results
        for (const result of event.message.content) {
          if (result.type === 'tool_result') {
            const toolCall = toolCallMap.get(result.tool_use_id);
            if (toolCall) {
              // Update the tool call with result
              toolCall.status = result.is_error ? 'error' : 'completed';
              toolCall.output = result.content;
              toolCall.isError = result.is_error ?? false;
              toolCall.completedAt = new Date(msg.created_at).getTime();
              toolCall.duration = toolCall.completedAt - toolCall.startedAt;
            }

            // Add tool_result block
            blocks.push({
              id: `result-${result.tool_use_id}`,
              type: 'tool_result' as BlockType,
              content: result.content,
              messageId: msg.id,
              toolCall,
            });
          }
        }
        break;
      }

      case 'result': {
        // Final result event - we could add a completion block if needed
        // For now, just ensure all remaining tool calls are marked as completed
        for (const tc of toolCalls) {
          if (tc.status === 'running') {
            tc.status = 'completed';
          }
        }
        break;
      }

      // 'system' events are typically init events, we can skip them for display
    }
  }

  return { blocks, toolCalls };
}

/**
 * Check if a message is a structured message that should be parsed rather than displayed raw.
 */
export function isStructuredMessage(message: Message): boolean {
  return message.metadata?.structured === true;
}

/**
 * Check if message content appears to be raw JSON from Claude Code's stream-json output.
 * Used as a fallback filter when metadata isn't available.
 */
export function isRawJsonContent(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('{"type":"assistant"') ||
    trimmed.startsWith('{"type":"user"') ||
    trimmed.startsWith('{"type":"system"') ||
    trimmed.startsWith('{"type":"result"')
  );
}
