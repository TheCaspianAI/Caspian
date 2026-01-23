import { create } from 'zustand';

// Maximum number of animated message IDs to track (prevents memory leak)
const MAX_ANIMATED_IDS = 1000;

interface AnimationState {
  // Track which messages have been animated (by message ID)
  // Uses an array to maintain insertion order for LRU eviction
  animatedMessageIds: Set<string>;
  animatedMessageOrder: string[];  // Track insertion order for eviction

  // Actions
  markMessageAnimated: (messageId: string) => void;
  hasMessageBeenAnimated: (messageId: string) => boolean;
  clearAnimationState: () => void;
}

/**
 * Store for tracking which messages have already been animated.
 * Prevents animation replay when navigating back to a node.
 * State persists during the session and clears on app restart.
 *
 * Has a size limit of MAX_ANIMATED_IDS to prevent memory leaks.
 * When limit is exceeded, oldest entries are evicted (FIFO).
 */
export const useAnimationStore = create<AnimationState>((set, get) => ({
  animatedMessageIds: new Set<string>(),
  animatedMessageOrder: [],

  markMessageAnimated: (messageId: string) => {
    set((state) => {
      // Skip if already tracked
      if (state.animatedMessageIds.has(messageId)) {
        return state;
      }

      const newSet = new Set(state.animatedMessageIds);
      const newOrder = [...state.animatedMessageOrder];

      // Add new entry
      newSet.add(messageId);
      newOrder.push(messageId);

      // Evict oldest entries if over limit (FIFO eviction)
      while (newOrder.length > MAX_ANIMATED_IDS) {
        const oldest = newOrder.shift();
        if (oldest) {
          newSet.delete(oldest);
        }
      }

      return {
        animatedMessageIds: newSet,
        animatedMessageOrder: newOrder,
      };
    });
  },

  hasMessageBeenAnimated: (messageId: string) => {
    return get().animatedMessageIds.has(messageId);
  },

  clearAnimationState: () => {
    set({
      animatedMessageIds: new Set(),
      animatedMessageOrder: [],
    });
  },
}));
