import { create } from 'zustand';
import { isTauri } from '../utils/tauri';

interface WindowFocusState {
  isFocused: boolean;
  setFocused: (focused: boolean) => void;
  subscribeToWindowEvents: () => () => void;
}

export const useWindowFocusStore = create<WindowFocusState>((set) => ({
  isFocused: true, // Assume focused by default

  setFocused: (focused: boolean) => {
    set({ isFocused: focused });
  },

  subscribeToWindowEvents: () => {
    if (!isTauri()) {
      // In browser, use document visibility API as fallback
      const handleVisibilityChange = () => {
        set({ isFocused: !document.hidden });
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    let unlistenFocus: (() => void) | null = null;

    const setup = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const window = getCurrentWindow();

        unlistenFocus = await window.onFocusChanged(({ payload: focused }) => {
          set({ isFocused: focused });
        });
      } catch (error) {
        console.error('[WindowFocus] Failed to subscribe to window events:', error);
      }
    };

    setup();

    return () => {
      if (unlistenFocus) unlistenFocus();
    };
  },
}));
