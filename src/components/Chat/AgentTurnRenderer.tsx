import { useMemo } from 'react';
import type { Message, LiveBlock, LiveToolCall } from '../../types';
import { parseStoredStructuredMessages, isStructuredMessage, isRawJsonContent } from '../../utils/structuredMessageParser';
import { isContextOnlyMessage } from '../../utils/contextUtils';
import { isInternalMessage } from '../../utils/messageFilters';
import { StructuredMessageRenderer } from './StructuredMessageRenderer';
import { AgentMessageRenderer } from './AgentMessageRenderer';
import { ActivityIndicator } from './ActivityIndicator';

interface AgentTurnRendererProps {
  messages: Message[];
  isAgentRunning?: boolean;
  isStreaming?: boolean;
  // Live data from store (for active streaming)
  liveToolCalls?: LiveToolCall[];
  liveBlocks?: LiveBlock[];
  // Whether this is live streaming data (true) vs historical persisted data (false)
  isLiveData?: boolean;
}

/**
 * Renders agent messages for a single conversation turn.
 * Handles both structured messages (JSON from stream-json) and
 * non-structured messages (plain text from legacy or non-streaming output).
 *
 * Visual flow:
 * 1. Shows unified activity indicator whenever agent is running
 * 2. Content (tool calls or text) appears below the indicator as it streams
 */
export function AgentTurnRenderer({
  messages,
  isAgentRunning = false,
  isStreaming = false,
  liveToolCalls = [],
  liveBlocks = [],
  isLiveData = false,
}: AgentTurnRendererProps) {
  // Filter out context-only messages and internal/debug messages
  const filteredMessages = useMemo(() => {
    return messages.filter(m =>
      !isContextOnlyMessage(m.content) && !isInternalMessage(m)
    );
  }, [messages]);

  // Check if we have live streaming data (takes priority)
  // Only consider data "live" if both the prop says so AND we have data in the arrays
  const hasLiveData = isLiveData && (liveToolCalls.length > 0 || liveBlocks.length > 0);

  // Parse structured messages from this turn
  const { structuredBlocks, structuredToolCalls, hasStructuredData } = useMemo(() => {
    // If we have live streaming data AND we're actually streaming, use that
    if (hasLiveData) {
      return {
        structuredBlocks: liveBlocks,
        structuredToolCalls: liveToolCalls,
        hasStructuredData: true,
      };
    }

    // Otherwise, parse persisted structured messages
    const structuredMessages = filteredMessages.filter(m => isStructuredMessage(m));
    if (structuredMessages.length > 0) {
      const parsed = parseStoredStructuredMessages(structuredMessages);
      return {
        structuredBlocks: parsed.blocks,
        structuredToolCalls: parsed.toolCalls,
        hasStructuredData: parsed.blocks.length > 0 || parsed.toolCalls.length > 0,
      };
    }

    return {
      structuredBlocks: [],
      structuredToolCalls: [],
      hasStructuredData: false,
    };
  }, [filteredMessages, hasLiveData, liveBlocks, liveToolCalls, isLiveData]);

  // Get non-structured messages (for legacy rendering)
  const nonStructuredMessages = useMemo(() => {
    return filteredMessages.filter(m =>
      !isStructuredMessage(m) && !isRawJsonContent(m.content)
    );
  }, [filteredMessages]);

  // Determine if we have any content to display
  const hasAnyContent = hasStructuredData || nonStructuredMessages.length > 0;

  // Show unified activity indicator whenever agent is running
  // This provides consistent visual feedback across all states
  const showActivityIndicator = isAgentRunning;

  // If nothing to render and agent not running, return null
  if (!hasAnyContent && !isAgentRunning) {
    return null;
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] py-2">
        {/* Unified activity indicator - shown whenever agent is running */}
        <ActivityIndicator
          isVisible={showActivityIndicator}
          toolCalls={liveToolCalls}
        />

        {/* Content container with coordinated entry animation */}
        {hasAnyContent && (
          <div className={hasLiveData ? 'animate-content-enter' : ''}>
            {/* Render structured content if available */}
            {hasStructuredData && (
              <StructuredMessageRenderer
                blocks={structuredBlocks}
                toolCalls={structuredToolCalls}
                isAgentRunning={isAgentRunning}
                isStreaming={isStreaming}
                isLiveData={isLiveData}
              />
            )}

            {/* Render non-structured messages via legacy renderer */}
            {!hasStructuredData && nonStructuredMessages.map((message, index) => (
              <AgentMessageRenderer
                key={message.id}
                content={message.content}
                isAgentRunning={isAgentRunning && index === nonStructuredMessages.length - 1}
                isStreaming={isStreaming && index === nonStructuredMessages.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
