import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { MentionAutocomplete } from './MentionAutocomplete';
import {
  ALLOWED_EXTENSIONS,
  processFilesToAttachments,
  formatFileSize,
} from '../../utils/fileUtils';
import type { Attachment } from '../../types';

// Model options
const MODELS = [
  { id: 'opus-4.5', displayName: 'Opus 4.5' },
  { id: 'sonnet-4.5', displayName: 'Sonnet 4.5' },
  { id: 'haiku', displayName: 'Haiku' },
];

interface EnhancedChatInputProps {
  onSend: (content: string, attachments?: Attachment[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EnhancedChatInput({
  onSend,
  placeholder = 'Ask to make changes, @mention files',
  disabled = false,
}: EnhancedChatInputProps) {
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { attachments, addAttachment, removeAttachment, clearAttachments, selectedModel, setSelectedModel, agentMode, cycleAgentMode } = useUIStore();

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownOpen]);

  // Auto-resize textarea with max height for 3-5 sentences
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Handle file selection from file picker
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

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim(), attachments.length > 0 ? attachments : undefined);
      setInput('');
      clearAttachments();
      setMentionOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't submit if mention autocomplete is open
    if (mentionOpen && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      return; // Let MentionAutocomplete handle these
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    if (e.key === 'Escape' && mentionOpen) {
      setMentionOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInput(value);

    // Detect @ for mentions
    // Look backwards from cursor to find @
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space after @ (completed mention) or no @ at all
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 30) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setMentionOpen(textAfterAt.length > 0);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }
  };

  const handleMentionSelect = (mention: string) => {
    if (mentionStartIndex >= 0) {
      // Replace @query with @mention
      const before = input.slice(0, mentionStartIndex);
      const after = input.slice(mentionStartIndex + 1 + mentionQuery.length);
      setInput(`${before}@${mention} ${after}`);
    }
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    textareaRef.current?.focus();
  };

  return (
    <div className="composer-container-v2 p-3 flex flex-col gap-2">
      {/* Attachment chips - show above input when files are attached */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.06] border border-white/[0.06] rounded-lg text-[11px] text-white/[0.70] flex-shrink-0"
            >
              <svg className="w-3 h-3 text-white/[0.45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[100px] 2xl:max-w-[150px] 3xl:max-w-[200px] truncate">{attachment.name}</span>
              <span className="text-white/[0.35]">({formatFileSize(attachment.size)})</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="ml-0.5 text-white/[0.35] hover:text-white/[0.65] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Row 1: Textarea with attachment and send buttons */}
      <div className="flex items-start gap-2.5">
        {/* Left: Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center flex-shrink-0 transition-colors mt-1 ${
            attachments.length > 0
              ? 'text-interactive'
              : 'text-white/[0.55] hover:text-white/[0.75]'
          }`}
          title="Attach file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept={ALLOWED_EXTENSIONS.join(',')}
        />

        {/* Center: Textarea */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full bg-transparent resize-none text-[14px] leading-[20px]
              focus:outline-none
              placeholder:text-white/[0.65]
              text-text-primary
              break-words overflow-y-auto
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={{ minHeight: '20px', maxHeight: '120px', wordWrap: 'break-word', overflowWrap: 'break-word' }}
          />

          {/* Mention Autocomplete */}
          <MentionAutocomplete
            query={mentionQuery}
            isOpen={mentionOpen}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
        </div>

        {/* Right: Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className={`w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all flex-shrink-0 mt-1
            ${
              disabled || !input.trim()
                ? 'text-white/[0.25] cursor-not-allowed'
                : 'text-white/[0.85] bg-white/[0.08] hover:bg-white/[0.12] active:bg-white/[0.15]'
            }
          `}
          title="Send message (Enter)"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      </div>

      {/* Row 2: Controls - model picker and plan toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        {/* Left: Model selector */}
        <div className="relative" ref={modelDropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="h-[24px] flex items-center gap-1 px-2 text-[11px] leading-[16px] font-medium text-white/[0.55] hover:text-white/[0.75] border border-white/[0.08] hover:border-white/[0.12] rounded-md transition-colors"
          >
            <span>{currentModel.displayName}</span>
            <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Model dropdown */}
          {modelDropdownOpen && (
            <div
              className="absolute bottom-full mb-1.5 left-0 min-w-[120px] glass-popover border border-white/[0.08] rounded-xl overflow-hidden z-50"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-surface-hover transition-colors flex items-center gap-2 ${
                    model.id === selectedModel ? 'bg-surface-secondary text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {model.id === selectedModel && (
                    <svg className="w-3 h-3 text-interactive" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                  <span className={model.id === selectedModel ? '' : 'ml-5'}>{model.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Plan mode toggle */}
        <button
          onClick={cycleAgentMode}
          className={`h-[24px] flex items-center gap-1.5 px-2 text-[11px] leading-[16px] font-medium border rounded-md transition-colors ${
            agentMode === 'plan'
              ? 'text-interactive border-interactive/[0.30] bg-interactive/[0.08]'
              : 'text-white/[0.55] border-white/[0.08] hover:text-white/[0.75] hover:border-white/[0.12]'
          }`}
          title={agentMode === 'plan' ? 'Plan mode - agent will plan before executing' : 'Agent mode'}
        >
          <span>Plan</span>
          {/* Compact toggle: 24x12px */}
          <div className={`w-6 h-3 rounded-full transition-colors relative ${
            agentMode === 'plan' ? 'bg-interactive' : 'bg-white/[0.20]'
          }`}>
            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${
              agentMode === 'plan' ? 'right-0.5' : 'left-0.5'
            }`} />
          </div>
        </button>
      </div>
    </div>
  );
}
