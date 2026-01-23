import type { Message } from '../types';

/**
 * Check if a message is an internal/debug message that should be hidden from users.
 * Internal messages include:
 * - Init events (system initialization)
 * - Complete events (session stats)
 * - Raw stdout that fails JSON parsing (CLI status messages like "No response requested")
 */
export function isInternalMessage(message: Message): boolean {
  return message.metadata?.internal === true;
}
