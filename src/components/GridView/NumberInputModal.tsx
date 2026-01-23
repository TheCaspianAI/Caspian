import { useState, useRef, useEffect } from 'react';

interface NumberInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  maxIndex: number;
}

export function NumberInputModal({ isOpen, onClose, onSubmit, maxIndex }: NumberInputModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-xl p-4 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm text-text-secondary">
            Jump to card (1-{maxIndex})
          </label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 5 or 2.3 (page.card)"
            className="w-48 px-3 py-2 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-interactive/50"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-interactive/20 text-interactive text-sm font-medium hover:bg-interactive/30 transition-colors"
            >
              Go
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
