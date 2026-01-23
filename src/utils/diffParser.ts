import type { DiffLine, DiffFile, ParsedDiff } from '../types';

/**
 * Parse a unified diff string into structured data
 */
export function parseDiff(diffText: string): ParsedDiff {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }
      const match = line.match(/diff --git a\/(.+?) b\//);
      const filename = match ? match[1] : 'Unknown file';
      currentFile = { filename, lines: [], addCount: 0, removeCount: 0 };
      currentFile.lines.push({ type: 'header', content: line });
    } else if (currentFile) {
      if (line.startsWith('@@')) {
        currentFile.lines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.lines.push({ type: 'add', content: line.slice(1) });
        currentFile.addCount++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.lines.push({ type: 'remove', content: line.slice(1) });
        currentFile.removeCount++;
      } else if (line.startsWith('Binary files')) {
        currentFile.lines.push({ type: 'binary', content: line });
      } else if (line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        currentFile.lines.push({ type: 'header', content: line });
      } else {
        currentFile.lines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
      }
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  const totalAdditions = files.reduce((sum, f) => sum + f.addCount, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.removeCount, 0);

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFiles: files.length,
  };
}

/**
 * Parse an inline diff from Edit tool output
 * Edit tool shows old_string → new_string changes
 */
export function parseEditDiff(oldString: string, newString: string): ParsedDiff {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');

  const diffLines: DiffLine[] = [];
  let addCount = 0;
  let removeCount = 0;

  // Simple diff - show removals then additions
  for (const line of oldLines) {
    diffLines.push({ type: 'remove', content: line });
    removeCount++;
  }
  for (const line of newLines) {
    diffLines.push({ type: 'add', content: line });
    addCount++;
  }

  return {
    files: [{
      filename: 'edit',
      lines: diffLines,
      addCount,
      removeCount,
    }],
    totalAdditions: addCount,
    totalDeletions: removeCount,
    totalFiles: 1,
  };
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

/**
 * Get filename from path
 */
export function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}
