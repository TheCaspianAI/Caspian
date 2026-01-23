import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useKeyboardShortcuts() {
  const {
    cycleAgentMode,
    bottomSheetOpen,
  } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when bottom sheet is open
      if (bottomSheetOpen) return;

      // Shift+Tab → Cycle agent mode (Normal → Plan → Auto)
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        cycleAgentMode();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    bottomSheetOpen,
    cycleAgentMode,
  ]);
}
