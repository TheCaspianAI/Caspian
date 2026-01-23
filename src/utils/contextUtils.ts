/**
 * Utilities for handling CONTEXT markers and internal tags in agent messages.
 *
 * CONTEXT markers are used to track what a conversation is about.
 * They are injected into agent prompts and output at the end of responses.
 * Format: [CONTEXT: 2-6 words describing the task]
 *
 * Thinking tags (<thinking>...</thinking>) are Claude's internal reasoning
 * that should not be displayed to users in the chat.
 *
 * These markers should:
 * - Be extracted and saved to node.context for sidebar display (CONTEXT only)
 * - Be stripped from chat display (never shown to users)
 */

const CONTEXT_REGEX = /\[CONTEXT:\s*([^\]]+)\]/gi;
// Match <thinking>...</thinking> tags including multiline content
const THINKING_REGEX = /<thinking>[\s\S]*?<\/thinking>/gi;

/**
 * Strip CONTEXT markers and thinking tags from text content.
 * These are internal markers that should not be displayed to users.
 *
 * @param text - Text that may contain [CONTEXT: ...] markers or <thinking> tags
 * @returns Text with all internal markers removed
 */
export function stripContextMarkers(text: string): string {
  return text
    .replace(THINKING_REGEX, '')  // Remove thinking blocks first
    .replace(CONTEXT_REGEX, '')   // Then remove context markers
    .trim();
}

/**
 * Check if a message contains ONLY a CONTEXT marker (no other content).
 * Used to filter out messages that are purely context markers.
 *
 * @param content - Message content to check
 * @returns True if the message contains only a CONTEXT marker
 */
export function isContextOnlyMessage(content: string): boolean {
  const stripped = stripContextMarkers(content);
  return stripped.length === 0;
}
