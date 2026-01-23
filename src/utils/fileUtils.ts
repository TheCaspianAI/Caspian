import type { Attachment } from '../types';
import { isTauri } from './tauri';

export const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB

export const ALLOWED_EXTENSIONS = [
  // Code files
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt',
  // Config/data files
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
  '.html', '.css', '.scss', '.sass', '.less',
  '.sql', '.sh', '.bash', '.zsh', '.fish',
  // Images (Claude supports these natively)
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg',
  // Documents (Claude supports PDF natively; others may need text extraction)
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
];

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Validate a file for attachment
 * Returns error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
  }

  // Check extension
  const ext = getFileExtension(file.name);
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type "${ext}" is not supported`;
  }

  return null;
}

/**
 * Read file as base64 string
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:text/plain;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Process a file into an Attachment object
 * Returns the attachment or throws an error
 */
export async function processFileToAttachment(file: File): Promise<Attachment> {
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const content = await readFileAsBase64(file);
  const ext = getFileExtension(file.name);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    path: URL.createObjectURL(file),
    type: file.type || ext,
    size: file.size,
    content,
  };
}

/**
 * Process multiple files into attachments
 * Returns successfully processed attachments and any errors
 */
export async function processFilesToAttachments(
  files: FileList | File[]
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const attachments: Attachment[] = [];
  const errors: string[] = [];

  for (const file of Array.from(files)) {
    try {
      const attachment = await processFileToAttachment(file);
      attachments.push(attachment);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Failed to process ${file.name}`);
    }
  }

  return { attachments, errors };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Check if a file type is an image
 */
export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
}

/**
 * Get filename from a file path
 */
export function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.jsx': 'text/javascript',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Process files from Tauri file drop (using file paths)
 * This reads files using Tauri's fs API
 */
export async function processFilePathsToAttachments(
  filePaths: string[]
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  if (!isTauri()) {
    return { attachments: [], errors: ['File drop only works in Tauri environment'] };
  }

  const attachments: Attachment[] = [];
  const errors: string[] = [];

  // Dynamically import Tauri fs module
  const { readFile, stat } = await import('@tauri-apps/plugin-fs');

  for (const filePath of filePaths) {
    try {
      const fileName = getFileName(filePath);
      const ext = getFileExtension(fileName);

      // Check extension
      if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`File type "${ext}" is not supported: ${fileName}`);
        continue;
      }

      // Get file stats for size check
      const fileStats = await stat(filePath);
      const fileSize = fileStats.size;

      // Check file size
      if (fileSize > MAX_FILE_SIZE) {
        errors.push(`File "${fileName}" exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        continue;
      }

      // Read file as binary
      const fileData = await readFile(filePath);

      // Convert to base64
      const base64 = btoa(
        Array.from(new Uint8Array(fileData))
          .map(byte => String.fromCharCode(byte))
          .join('')
      );

      const mimeType = getMimeType(ext);

      attachments.push({
        id: crypto.randomUUID(),
        name: fileName,
        path: filePath, // Use actual file path
        type: mimeType,
        size: fileSize,
        content: base64,
      });
    } catch (error) {
      const fileName = getFileName(filePath);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      errors.push(`Failed to read file "${fileName}": ${errorMessage}`);
    }
  }

  return { attachments, errors };
}
