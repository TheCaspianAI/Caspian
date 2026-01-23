import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';

interface Model {
  id: string;
  name: string;
  provider: 'claude';
  displayName: string;
}

const MODELS: Model[] = [
  { id: 'opus-4.5', name: 'claude-opus-4.5', provider: 'claude', displayName: 'Opus 4.5' },
  { id: 'sonnet-4.5', name: 'claude-sonnet-4.5', provider: 'claude', displayName: 'Sonnet 4.5' },
  { id: 'haiku', name: 'claude-haiku', provider: 'claude', displayName: 'Haiku' },
];

// Sparkle icon component
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z" />
      <path d="M18 14L18.62 17.38L22 18L18.62 18.62L18 22L17.38 18.62L14 18L17.38 17.38L18 14Z" opacity="0.6" />
      <path d="M6 14L6.38 16.62L9 17L6.38 17.38L6 20L5.62 17.38L3 17L5.62 16.62L6 14Z" opacity="0.4" />
    </svg>
  );
}

export function ModelSelector() {
  const { selectedModel, setSelectedModel } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model: Model) => {
    setSelectedModel(model.id);
    setIsOpen(false);
  };

  // All models are Claude models
  const claudeModels = MODELS;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-caption font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
      >
        <SparkleIcon className="w-3.5 h-3.5 text-interactive" />
        <span>{currentModel.displayName}</span>
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 min-w-[180px] glass-popover border border-white/[0.08] rounded-xl overflow-hidden z-50"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        >
          {/* Claude models */}
          <div>
            <div className="px-3 py-1.5 text-caption font-medium text-text-tertiary bg-white/[0.03]">
              Claude
            </div>
            {claudeModels.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelect(model)}
                className={`w-full px-3 py-1.5 text-left text-caption hover:bg-surface-hover transition-colors flex items-center gap-2 ${
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
        </div>
      )}
    </div>
  );
}
