/**
 * toolUtils.ts - Tool name and display utilities
 */

// Tool name to display name mapping
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  Read: 'Reading',
  Write: 'Writing',
  Edit: 'Editing',
  Bash: 'Running',
  Glob: 'Searching',
  Grep: 'Searching',
  Task: 'Running task',
  WebFetch: 'Fetching',
};

/**
 * Get a friendly display name for a tool
 */
export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}
