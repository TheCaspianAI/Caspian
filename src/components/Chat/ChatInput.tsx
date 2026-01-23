import { useState, useRef, useEffect } from 'react';
import type { ChatStateType } from '../../types';

interface ChatInputProps {
  onSend: (content: string) => void;
  chatState: ChatStateType;
  lockedReason?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  chatState,
  lockedReason,
  placeholder = 'Type a message...',
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLocked = chatState === 'locked';
  const isAwaitingHuman = chatState === 'awaiting_human';
  const isDisabled = disabled || isLocked;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isDisabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getPlaceholder = () => {
    if (isLocked) {
      return lockedReason || 'Chat locked - agent is running...';
    }
    if (isAwaitingHuman) {
      return 'Caspian is waiting for your response...';
    }
    return placeholder;
  };

  const getStatusIndicator = () => {
    if (isLocked) {
      return (
        <div className="flex items-center gap-2 text-caption text-warning">
          <span className="animate-pulse">●</span>
          <span>Agent running</span>
        </div>
      );
    }
    if (isAwaitingHuman) {
      return (
        <div className="flex items-center gap-2 text-caption text-interactive">
          <span className="animate-pulse">●</span>
          <span>Waiting for your input</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border-t border-border-primary bg-surface-primary p-4">
      {getStatusIndicator() && (
        <div className="mb-2">
          {getStatusIndicator()}
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isDisabled}
            rows={1}
            className={`w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg resize-none
              focus:outline-none focus:border-interactive
              placeholder:text-text-tertiary
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !input.trim()}
          className={`px-4 py-2 rounded-lg font-medium transition-colors
            ${
              isDisabled || !input.trim()
                ? 'bg-surface-secondary text-text-tertiary cursor-not-allowed'
                : 'bg-interactive text-white hover:bg-interactive-hover'
            }
          `}
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
      <div className="mt-2 text-caption text-text-tertiary">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
