/**
 * stringUtils.ts - String manipulation utilities
 */

/**
 * Truncate path to show just filename with optional parent
 */
export function truncatePath(path: string, maxLen: number = 30): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path.slice(-maxLen);
  // Show ...parent/file.ext
  const filename = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  const shortened = `.../${parent}/${filename}`;
  return shortened.length <= maxLen ? shortened : `.../${filename}`;
}
