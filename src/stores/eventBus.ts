/**
 * eventBus.ts - Centralized event subscription management
 *
 * Provides a single subscription point for shared Tauri events to prevent
 * multiple components from creating duplicate subscriptions.
 *
 * Components should subscribe to store selectors instead of raw events.
 */

import { create } from 'zustand';
import { safeListen } from '../utils/tauri';

// Event payload types
export interface AgentOutputEvent {
  node_id: string;
  session_id?: string;
  content?: string;
}

export interface AgentCompleteEvent {
  node_id: string;
  session_id: string;
  success: boolean;
  message?: string;
  node_name?: string;
  node_context?: string;
}

export interface FilesChangedEvent {
  node_id: string;
  paths: string[];
  timestamp: number;
}

// Callback types
type AgentOutputCallback = (event: AgentOutputEvent) => void;
type AgentCompleteCallback = (event: AgentCompleteEvent) => void;
type FilesChangedCallback = (event: FilesChangedEvent) => void;

interface EventBusState {
  // Track subscription status
  isSubscribed: boolean;
  subscriberCount: number;

  // Registered callbacks for each event type
  agentOutputCallbacks: Map<string, AgentOutputCallback>;
  agentCompleteCallbacks: Map<string, AgentCompleteCallback>;
  filesChangedCallbacks: Map<string, FilesChangedCallback>;

  // Actions
  subscribe: () => Promise<void>;
  unsubscribe: () => void;

  // Register callbacks (returns cleanup function)
  onAgentOutput: (id: string, callback: AgentOutputCallback) => () => void;
  onAgentComplete: (id: string, callback: AgentCompleteCallback) => () => void;
  onFilesChanged: (id: string, callback: FilesChangedCallback) => () => void;
}

// Store unsubscribe functions
let unlistenAgentOutput: (() => void) | null = null;
let unlistenAgentComplete: (() => void) | null = null;
let unlistenFilesChanged: (() => void) | null = null;

export const useEventBus = create<EventBusState>((set, get) => ({
  isSubscribed: false,
  subscriberCount: 0,
  agentOutputCallbacks: new Map(),
  agentCompleteCallbacks: new Map(),
  filesChangedCallbacks: new Map(),

  subscribe: async () => {
    const state = get();
    set({ subscriberCount: state.subscriberCount + 1 });

    // Already subscribed, just increment count
    if (state.isSubscribed) {
      return;
    }

    set({ isSubscribed: true });

    // Set up agent:output listener
    unlistenAgentOutput = await safeListen<AgentOutputEvent>('agent:output', (payload) => {
      const callbacks = get().agentOutputCallbacks;
      callbacks.forEach(cb => cb(payload));
    });

    // Set up agent:complete listener
    unlistenAgentComplete = await safeListen<AgentCompleteEvent>('agent:complete', (payload) => {
      const callbacks = get().agentCompleteCallbacks;
      callbacks.forEach(cb => cb(payload));
    });

    // Set up files:changed listener
    unlistenFilesChanged = await safeListen<FilesChangedEvent>('files:changed', (payload) => {
      const callbacks = get().filesChangedCallbacks;
      callbacks.forEach(cb => cb(payload));
    });
  },

  unsubscribe: () => {
    const state = get();
    const newCount = Math.max(0, state.subscriberCount - 1);
    set({ subscriberCount: newCount });

    // Only unsubscribe when no more subscribers
    if (newCount === 0 && state.isSubscribed) {
      if (unlistenAgentOutput) {
        unlistenAgentOutput();
        unlistenAgentOutput = null;
      }
      if (unlistenAgentComplete) {
        unlistenAgentComplete();
        unlistenAgentComplete = null;
      }
      if (unlistenFilesChanged) {
        unlistenFilesChanged();
        unlistenFilesChanged = null;
      }
      set({ isSubscribed: false });
    }
  },

  onAgentOutput: (id: string, callback: AgentOutputCallback) => {
    const state = get();
    const newCallbacks = new Map(state.agentOutputCallbacks);
    newCallbacks.set(id, callback);
    set({ agentOutputCallbacks: newCallbacks });

    return () => {
      const currentState = get();
      const updatedCallbacks = new Map(currentState.agentOutputCallbacks);
      updatedCallbacks.delete(id);
      set({ agentOutputCallbacks: updatedCallbacks });
    };
  },

  onAgentComplete: (id: string, callback: AgentCompleteCallback) => {
    const state = get();
    const newCallbacks = new Map(state.agentCompleteCallbacks);
    newCallbacks.set(id, callback);
    set({ agentCompleteCallbacks: newCallbacks });

    return () => {
      const currentState = get();
      const updatedCallbacks = new Map(currentState.agentCompleteCallbacks);
      updatedCallbacks.delete(id);
      set({ agentCompleteCallbacks: updatedCallbacks });
    };
  },

  onFilesChanged: (id: string, callback: FilesChangedCallback) => {
    const state = get();
    const newCallbacks = new Map(state.filesChangedCallbacks);
    newCallbacks.set(id, callback);
    set({ filesChangedCallbacks: newCallbacks });

    return () => {
      const currentState = get();
      const updatedCallbacks = new Map(currentState.filesChangedCallbacks);
      updatedCallbacks.delete(id);
      set({ filesChangedCallbacks: updatedCallbacks });
    };
  },
}));

/**
 * Hook to use centralized event subscriptions
 * Automatically subscribes on mount and unsubscribes on unmount
 */
export function useEventSubscription() {
  const subscribe = useEventBus(state => state.subscribe);
  const unsubscribe = useEventBus(state => state.unsubscribe);

  return { subscribe, unsubscribe };
}
