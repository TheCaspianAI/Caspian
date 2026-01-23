import { useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import {
  ALLOWED_EXTENSIONS,
  processFilesToAttachments,
  formatFileSize,
} from '../../utils/fileUtils';

export function AttachmentButton() {
  const { attachments, addAttachment, removeAttachment } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { attachments: processed, errors } = await processFilesToAttachments(files);

    // Add successfully processed attachments
    for (const attachment of processed) {
      addAttachment(attachment);
    }

    // Show errors if any
    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Attachment chips - horizontal scroll, no wrap */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto max-w-[300px] scrollbar-none">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1 px-2 py-1 bg-surface-secondary rounded text-caption text-text-secondary flex-shrink-0"
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[80px] truncate">{attachment.name}</span>
              <span className="text-text-tertiary whitespace-nowrap">({formatFileSize(attachment.size)})</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="ml-1 text-text-tertiary hover:text-text-primary flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attachment button (+ icon) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
        title="Attach file"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept={ALLOWED_EXTENSIONS.join(',')}
      />
    </div>
  );
}
