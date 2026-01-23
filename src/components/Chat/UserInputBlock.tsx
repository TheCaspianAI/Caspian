import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserInputOption, UserInputSelection } from '../../types';

interface UserInputBlockProps {
  toolId: string;
  question: string;
  header?: string;
  options: UserInputOption[];
  multiSelect?: boolean;
  onSelect: (selection: UserInputSelection) => void;
  onDismiss?: () => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
  submittedSelection?: UserInputSelection;
}

export function UserInputBlock({
  toolId,
  question,
  header: _header,
  options,
  multiSelect = false,
  onSelect,
  onDismiss,
  isSubmitting = false,
  isSubmitted = false,
  submittedSelection,
}: UserInputBlockProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isOtherMode, setIsOtherMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs to capture current values and avoid stale closures in event handlers
  const customInputRef = useRef(customInput);
  const isOtherModeRef = useRef(isOtherMode);

  // Keep refs in sync with state
  useEffect(() => {
    customInputRef.current = customInput;
  }, [customInput]);

  useEffect(() => {
    isOtherModeRef.current = isOtherMode;
  }, [isOtherMode]);

  // Total options including "Other"
  const totalOptions = options.length + 1;
  const otherIndex = options.length;

  // Define handlers BEFORE the keyboard useEffect that uses them
  const handleSelect = useCallback(
    (index: number) => {
      if (isSubmitting || isSubmitted) return;

      if (multiSelect) {
        // Multi-select mode: toggle selection
        setSelectedIndices(prev => {
          const newSet = new Set(prev);
          if (newSet.has(index)) {
            newSet.delete(index);
          } else {
            newSet.add(index);
          }
          return newSet;
        });
      } else {
        // Single-select mode: auto-submit (existing behavior)
        const option = options[index];
        onSelect({
          toolId,
          selectedIndex: index,
          selectedLabel: option.label,
          selectedDescription: option.description,
        });
      }
    },
    [toolId, options, onSelect, isSubmitting, isSubmitted, multiSelect]
  );

  const handleMultiSelectSubmit = useCallback(() => {
    if (isSubmitting || isSubmitted || selectedIndices.size === 0) return;

    const selectedArray = Array.from(selectedIndices).sort();
    const selectedOptions = selectedArray.map(idx => options[idx]);

    const descriptions = selectedOptions.map(opt => opt.description).filter(Boolean) as string[];

    onSelect({
      toolId,
      selectedIndex: selectedArray,
      selectedLabel: selectedOptions.map(opt => opt.label),
      selectedDescription: descriptions.length > 0 ? descriptions : undefined,
    });
  }, [toolId, options, selectedIndices, onSelect, isSubmitting, isSubmitted]);

  // Use ref to get current customInput value - avoids stale closure issues
  const handleCustomSubmit = useCallback(() => {
    const currentInput = customInputRef.current.trim();
    if (isSubmitting || isSubmitted || !currentInput) return;

    onSelect({
      toolId,
      selectedIndex: otherIndex,
      selectedLabel: 'Other',
      selectedDescription: currentInput,
    });
  }, [toolId, otherIndex, onSelect, isSubmitting, isSubmitted]);

  // Handle keyboard navigation
  // Note: Using refs for isOtherMode and customInput to avoid stale closures
  // and prevent re-registration on every keystroke
  useEffect(() => {
    if (isSubmitted || isSubmitting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // STRICT FOCUS CHECK: Only handle keyboard events when this component has focus
      // This prevents capturing keypresses from other parts of the UI (e.g., navigation Enter)
      if (!containerRef.current?.contains(document.activeElement)) {
        return;
      }

      // Use refs to get current state values (avoids stale closures)
      const currentIsOtherMode = isOtherModeRef.current;
      const currentCustomInput = customInputRef.current;

      // If in Other mode, ONLY allow Enter/Escape - block ALL other keys
      // This prevents number keys from triggering option selection while typing
      if (currentIsOtherMode) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsOtherMode(false);
          setCustomInput('');
        } else if (e.key === 'Enter' && currentCustomInput.trim()) {
          e.preventDefault();
          // Call onSelect directly with current ref value to avoid stale closure
          onSelect({
            toolId,
            selectedIndex: otherIndex,
            selectedLabel: 'Other',
            selectedDescription: currentCustomInput.trim(),
          });
        }
        // Block all other keys when in Other mode - don't let them fall through
        return;
      }

      // Number keys 1-9 for quick selection (including "Other" option)
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < totalOptions) {
          e.preventDefault();
          if (index === otherIndex) {
            setIsOtherMode(true);
            if (multiSelect) setSelectedIndices(new Set()); // Clear selections when entering Other mode
          } else {
            handleSelect(index);
          }
        }
      }

      // Arrow navigation (including "Other" option)
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === null) return 0;
          return Math.min(prev + 1, totalOptions - 1);
        });
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === null) return totalOptions - 1;
          return Math.max(prev - 1, 0);
        });
      }

      // Enter to confirm selection or toggle in multi-select
      if (e.key === 'Enter' && focusedIndex !== null) {
        e.preventDefault();
        if (focusedIndex === otherIndex) {
          setIsOtherMode(true);
          if (multiSelect) setSelectedIndices(new Set()); // Clear selections when entering Other mode
        } else if (multiSelect) {
          // Toggle focused option in multi-select
          setSelectedIndices(prev => {
            const newSet = new Set(prev);
            newSet.has(focusedIndex) ? newSet.delete(focusedIndex) : newSet.add(focusedIndex);
            return newSet;
          });
        } else {
          handleSelect(focusedIndex); // Auto-submit in single-select
        }
      }

      // Enter to submit in multi-select when no focus and selections exist
      if (e.key === 'Enter' && focusedIndex === null && multiSelect && selectedIndices.size > 0) {
        e.preventDefault();
        handleMultiSelectSubmit();
      }

      // Escape to dismiss
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onDismiss) {
          onDismiss();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options.length, totalOptions, otherIndex, focusedIndex, selectedIndices, isSubmitted, isSubmitting, onDismiss, toolId, onSelect, handleSelect, multiSelect, handleMultiSelectSubmit]);

  // Focus container on mount for keyboard navigation
  // Use microtask delay to ensure any navigation keypresses have finished processing
  useEffect(() => {
    if (!isSubmitted && !isSubmitting) {
      const timer = setTimeout(() => {
        containerRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, isSubmitting]);

  // Focus input when entering other mode
  useEffect(() => {
    if (isOtherMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOtherMode]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`
        rounded-lg border bg-surface-secondary
        ${isSubmitted ? 'border-border-secondary opacity-75' : 'border-border-primary'}
        focus:outline-none focus:ring-1 focus:ring-interactive/50
      `}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border-secondary">
        {/* Status badge - top, left aligned */}
        {!isSubmitted && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium bg-surface-tertiary text-text-tertiary w-fit">
            <svg
              className="w-3 h-3 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
            </svg>
            AWAITING RESPONSE
          </span>
        )}
        {isSubmitted && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium bg-status-success/10 text-status-success w-fit">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            ANSWERED
          </span>
        )}
        {/* Question - below status */}
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-text-secondary flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="text-body text-text-primary font-medium">{question}</span>
        </div>
      </div>

      {/* Options */}
      <div className="p-2">
        {/* Regular options */}
        {options.map((option, index) => {
          const isSelected = multiSelect ? selectedIndices.has(index) : focusedIndex === index;
          const isHovered = hoveredIndex === index;
          const isFocused = focusedIndex === index;
          const wasSubmitted = isSubmitted && (
            Array.isArray(submittedSelection?.selectedIndex)
              ? submittedSelection.selectedIndex.includes(index)
              : submittedSelection?.selectedIndex === index
          );

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              disabled={isSubmitting || isSubmitted || isOtherMode}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left
                transition-colors duration-100
                ${wasSubmitted
                  ? 'bg-interactive/10 border border-interactive/30'
                  : isSubmitted || isOtherMode
                    ? 'opacity-50 cursor-not-allowed'
                    : isSelected || isHovered || isFocused
                      ? 'bg-surface-tertiary'
                      : 'hover:bg-surface-tertiary'
                }
                ${isSubmitting ? 'cursor-wait' : ''}
                disabled:cursor-not-allowed
              `}
            >
              {/* Selection indicator - checkbox for multi-select, number for single-select */}
              {multiSelect ? (
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-colors
                  ${isSelected || wasSubmitted
                    ? 'bg-interactive border-interactive'
                    : 'border-text-tertiary bg-surface-primary'
                  }
                `}>
                  {(isSelected || wasSubmitted) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ) : (
                <span
                  className={`
                    flex-shrink-0 w-6 h-6 flex items-center justify-center
                    rounded text-caption font-mono
                    ${wasSubmitted
                      ? 'bg-interactive text-white'
                      : 'bg-surface-tertiary text-text-secondary'
                    }
                  `}
                >
                  {index + 1}
                </span>
              )}

              {/* Option content */}
              <div className="flex-1 min-w-0">
                <span className={`text-body ${wasSubmitted ? 'text-text-primary font-medium' : 'text-text-primary'}`}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-caption text-text-tertiary mt-0.5 truncate">
                    {option.description}
                  </p>
                )}
              </div>

              {/* Selection indicator */}
              {wasSubmitted && (
                <svg
                  className="w-4 h-4 text-interactive flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Submit button for multi-select */}
        {multiSelect && !isSubmitted && !isOtherMode && selectedIndices.size > 0 && (
          <div className="px-2 pb-2">
            <button
              onClick={handleMultiSelectSubmit}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-md bg-interactive text-white font-medium text-body hover:bg-interactive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit {selectedIndices.size} {selectedIndices.size === 1 ? 'Selection' : 'Selections'}
            </button>
          </div>
        )}

        {/* Other option */}
        {!isOtherMode ? (
          <button
            onClick={() => {
              setIsOtherMode(true);
              if (multiSelect) setSelectedIndices(new Set()); // Clear selections when entering Other mode
            }}
            onMouseEnter={() => setHoveredIndex(otherIndex)}
            onMouseLeave={() => setHoveredIndex(null)}
            disabled={isSubmitting || isSubmitted}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left
              transition-colors duration-100
              ${isSubmitted && submittedSelection?.selectedLabel === 'Other'
                ? 'bg-interactive/10 border border-interactive/30'
                : isSubmitted
                  ? 'opacity-50 cursor-not-allowed'
                  : focusedIndex === otherIndex || hoveredIndex === otherIndex
                    ? 'bg-surface-tertiary'
                    : 'hover:bg-surface-tertiary'
              }
              ${isSubmitting ? 'cursor-wait' : ''}
              disabled:cursor-not-allowed
            `}
          >
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-caption font-mono bg-surface-tertiary text-text-secondary">
              {otherIndex + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-body text-text-primary">Other...</span>
              <p className="text-caption text-text-tertiary mt-0.5">Provide your own input</p>
            </div>
          </button>
        ) : (
          /* Text input for "Other" option */
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-surface-tertiary border border-interactive/30">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-caption font-mono bg-interactive text-white">
              {otherIndex + 1}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type your response..."
              className="flex-1 bg-transparent text-body text-text-primary placeholder-text-tertiary outline-none"
              disabled={isSubmitting}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim() || isSubmitting}
              className="px-3 py-1 rounded text-caption font-medium bg-interactive text-white hover:bg-interactive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
            <button
              onClick={() => {
                setIsOtherMode(false);
                setCustomInput('');
              }}
              className="p-1 rounded hover:bg-surface-secondary text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!isSubmitted && !isOtherMode && (
        <div className="px-4 py-2 border-t border-border-secondary">
          <p className="text-caption text-text-quaternary">
            {multiSelect ? (
              <>
                Press <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">1</kbd>-
                <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">{Math.min(totalOptions - 1, 9)}</kbd> to toggle,{' '}
                <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">Enter</kbd> to submit
              </>
            ) : (
              <>
                Press <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">1</kbd>-
                <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">{Math.min(totalOptions, 9)}</kbd> to select,
                or use <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">↑</kbd>
                <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">↓</kbd> and
                <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">Enter</kbd>
              </>
            )}
          </p>
        </div>
      )}
      {!isSubmitted && isOtherMode && (
        <div className="px-4 py-2 border-t border-border-secondary">
          <p className="text-caption text-text-quaternary">
            Press <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">Enter</kbd> to submit,
            <kbd className="px-1 py-0.5 bg-surface-tertiary rounded text-text-tertiary">Esc</kbd> to cancel
          </p>
        </div>
      )}

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-surface-primary/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 text-text-secondary">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-body">Sending response...</span>
          </div>
        </div>
      )}
    </div>
  );
}
