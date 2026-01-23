import { create } from 'zustand';
import { safeInvoke } from '../utils/tauri';
import { useAgentStore } from './agentStore';
import {
  getTurnsFromCache,
  setTurnsInCache,
  appendTurnToCache,
  updateTurnAgentMessages,
  invalidateTurns,
} from '../utils/nodeCache';
import type {
  Message,
  ChatStateEntry,
  ChatStateType,
  CommandResult,
  SenderType,
  MessageType,
  ConversationTurn,
  OrphanAgentMessages,
} from '../types';

// Default limits for fetching
const INITIAL_MESSAGE_LIMIT = 50;  // ~5-10 turns worth of messages (user + agent)
const AGENT_MESSAGE_LIMIT = 50;  // Limit agent messages per turn (for legacy single-turn refresh)

interface ChatStoreState {
  // NEW: Turn-based structure
  turns: ConversationTurn[];           // Ordered by createdAt
  orphanAgentMessages: OrphanAgentMessages | null;  // Messages before first user msg

  // Keep legacy messages for backward compatibility during transition
  // Components can read from here if they haven't migrated to turns yet
  _legacyMessages: Message[];

  // Loading states
  isLoading: boolean;
  isLoadingOlderTurns: boolean;
  hasOlderTurns: boolean;

  // Chat state
  chatState: ChatStateEntry | null;

  // Context
  currentWorkspaceId: string | null;
  currentNodeId: string | null;        // Renamed from currentBranchId

  // Error state
  error: string | null;

  // Actions
  setContext: (workspaceId: string, nodeId: string | null) => Promise<void>;
  fetchTurns: (workspaceId: string, nodeId: string | null) => Promise<void>;
  fetchOlderTurns: () => Promise<void>;
  sendMessage: (
    content: string,
    messageType?: MessageType,
    metadata?: Record<string, unknown>
  ) => Promise<Message | null>;
  fetchChatState: (workspaceId: string, nodeId: string | null) => Promise<void>;
  setChatState: (state: ChatStateType, lockedReason?: string) => Promise<void>;
  refreshLatestTurn: () => Promise<void>;

  // Turn management
  addTurnFromUserMessage: (message: Message) => void;
  updateTurnWithAgentMessages: (turnId: string, agentMessages: Message[]) => void;

  // Selectors
  getTurnById: (turnId: string) => ConversationTurn | undefined;
  getLatestTurn: () => ConversationTurn | undefined;

  // Legacy compatibility
  addMessage: (message: Message) => void;
  clearMessages: () => void;

  // Legacy getter for backward compatibility
  // Components using `messages` will get a flattened view
  get messages(): Message[];
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  turns: [],
  orphanAgentMessages: null,
  _legacyMessages: [],
  chatState: null,
  isLoading: false,
  isLoadingOlderTurns: false,
  hasOlderTurns: true,
  error: null,
  currentWorkspaceId: null,
  currentNodeId: null,

  // Computed getter for backward compatibility
  get messages() {
    const state = get();
    // Flatten turns back into messages array
    const allMessages: Message[] = [];

    // Add orphan messages first
    if (state.orphanAgentMessages) {
      allMessages.push(...state.orphanAgentMessages.messages);
    }

    // Add all turn messages
    for (const turn of state.turns) {
      allMessages.push(turn.userMessage);
      allMessages.push(...turn.agentResponse.messages);
    }

    return allMessages;
  },

  setContext: async (workspaceId: string, nodeId: string | null) => {
    const state = get();
    const contextChanged = state.currentWorkspaceId !== workspaceId || state.currentNodeId !== nodeId;

    if (!contextChanged) {
      return;
    }

    // Clear the agent output buffer for this node to prevent stale outputs
    if (nodeId) {
      useAgentStore.getState().clearOutputForNode(nodeId);
    }

    // Check cache first for instant display
    if (nodeId) {
      const cached = getTurnsFromCache(nodeId);

      if (cached.status === 'fresh' || cached.status === 'stale') {
        // INSTANT: Show cached turns immediately
        const legacyMessages = flattenTurnsToMessages(cached.data || []);
        set({
          currentWorkspaceId: workspaceId,
          currentNodeId: nodeId,
          turns: cached.data || [],
          _legacyMessages: legacyMessages,
          chatState: null,
          hasOlderTurns: true,
          isLoading: false,
        });

        // BACKGROUND: Revalidate in background without blocking
        queueMicrotask(() => {
          if (cached.status === 'stale') {
            get().fetchTurns(workspaceId, nodeId);
          }
          get().fetchChatState(workspaceId, nodeId);
        });

        return;
      }
    }

    // Cache miss - show loading state while fetching
    set({
      currentWorkspaceId: workspaceId,
      currentNodeId: nodeId,
      turns: [],
      _legacyMessages: [],
      chatState: null,
      hasOlderTurns: true,
      isLoading: true,
    });

    // Fetch turns
    get().fetchTurns(workspaceId, nodeId);
    get().fetchChatState(workspaceId, nodeId);
  },

  fetchTurns: async (workspaceId: string, nodeId: string | null) => {
    set({ isLoading: true, error: null });

    try {
      // Step 1: Fetch human messages first (they define turns)
      // Human messages are few, so we fetch generously
      const userResult = await safeInvoke<CommandResult<Message[]>>('get_messages', {
        workspaceId,
        nodeId,
        senderType: 'human',
        limit: INITIAL_MESSAGE_LIMIT,
      });

      if (!userResult?.success) {
        throw new Error(userResult?.error || 'Failed to fetch user messages');
      }

      const userMessages = userResult.data || [];

      // Step 2: If we have a nodeId, use single query for ALL agent messages
      // Then partition them client-side (avoids N+1 queries)
      let turns: ConversationTurn[] = [];
      let orphanAgentMessages: OrphanAgentMessages | null = null;

      if (nodeId && userMessages.length > 0) {
        // Fetch ALL agent messages for this node in one query
        const agentResult = await safeInvoke<CommandResult<Message[]>>('get_messages_for_node', {
          workspaceId,
          nodeId,
          limit: 1000, // Get all agent messages, they'll be partitioned by turn
        });

        const agentMessages = agentResult?.data?.filter(m => m.sender_type === 'agent') || [];

        // Build turns from user messages
        turns = userMessages.map((userMsg, idx) => {
          const nextUserMsg = userMessages[idx + 1];
          const userTime = new Date(userMsg.created_at).getTime();
          const nextUserTime = nextUserMsg ? new Date(nextUserMsg.created_at).getTime() : Infinity;

          // Find agent messages between this user message and the next
          const turnAgentMessages = agentMessages.filter(m => {
            const msgTime = new Date(m.created_at).getTime();
            return msgTime > userTime && msgTime < nextUserTime;
          });

          return {
            id: userMsg.id,
            userMessage: userMsg,
            agentResponse: {
              messages: turnAgentMessages,
              liveBlocks: [],
              liveToolCalls: [],
              isComplete: true,
              isStreaming: false,
            },
            createdAt: userMsg.created_at,
          } as ConversationTurn;
        });

        // Check for orphan agent messages (before first user message)
        const firstUserTime = userMessages.length > 0
          ? new Date(userMessages[0].created_at).getTime()
          : Infinity;
        const orphans = agentMessages.filter(m =>
          new Date(m.created_at).getTime() < firstUserTime
        );
        if (orphans.length > 0) {
          orphanAgentMessages = {
            messages: orphans,
            liveBlocks: [],
            liveToolCalls: [],
          };
        }
      } else {
        // No nodeId or no user messages - simple turn creation
        turns = userMessages.map(msg => ({
          id: msg.id,
          userMessage: msg,
          agentResponse: {
            messages: [],
            liveBlocks: [],
            liveToolCalls: [],
            isComplete: true,
            isStreaming: false,
          },
          createdAt: msg.created_at,
        }));
      }

      // Cache the turns
      if (nodeId) {
        setTurnsInCache(nodeId, turns);
      }

      // Build legacy messages array
      const legacyMessages = flattenTurnsToMessages(turns, orphanAgentMessages);

      set({
        turns,
        orphanAgentMessages,
        _legacyMessages: legacyMessages,
        isLoading: false,
        hasOlderTurns: userMessages.length >= INITIAL_MESSAGE_LIMIT,
      });

    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  fetchOlderTurns: async () => {
    const state = get();
    if (!state.currentWorkspaceId || !state.currentNodeId || state.isLoadingOlderTurns || !state.hasOlderTurns) {
      return;
    }

    set({ isLoadingOlderTurns: true });

    try {
      const oldestTurn = state.turns[0];
      const beforeId = oldestTurn?.userMessage.id;

      if (!beforeId) {
        set({ isLoadingOlderTurns: false, hasOlderTurns: false });
        return;
      }

      // Fetch older human messages
      const userResult = await safeInvoke<CommandResult<Message[]>>('get_messages', {
        workspaceId: state.currentWorkspaceId,
        nodeId: state.currentNodeId,
        senderType: 'human',
        limit: INITIAL_MESSAGE_LIMIT,
        beforeId,
      });

      if (!userResult?.success || !userResult.data) {
        set({ isLoadingOlderTurns: false, hasOlderTurns: false });
        return;
      }

      const olderUserMessages = userResult.data;
      const hasMore = olderUserMessages.length >= INITIAL_MESSAGE_LIMIT;

      if (olderUserMessages.length === 0) {
        set({ isLoadingOlderTurns: false, hasOlderTurns: false });
        return;
      }

      // Fetch agent messages for the time range of older user messages
      const agentResult = await safeInvoke<CommandResult<Message[]>>('get_messages_for_node', {
        workspaceId: state.currentWorkspaceId,
        nodeId: state.currentNodeId,
        limit: 1000,
        beforeId: oldestTurn.userMessage.id, // Get agent messages before current oldest turn
      });

      const agentMessages = agentResult?.data?.filter(m => m.sender_type === 'agent') || [];

      // Build turns from older user messages
      const olderTurns = olderUserMessages.map((userMsg, idx) => {
        const nextUserMsg = olderUserMessages[idx + 1] || oldestTurn?.userMessage;
        const userTime = new Date(userMsg.created_at).getTime();
        const nextUserTime = nextUserMsg ? new Date(nextUserMsg.created_at).getTime() : Infinity;

        const turnAgentMessages = agentMessages.filter(m => {
          const msgTime = new Date(m.created_at).getTime();
          return msgTime > userTime && msgTime < nextUserTime;
        });

        return {
          id: userMsg.id,
          userMessage: userMsg,
          agentResponse: {
            messages: turnAgentMessages,
            liveBlocks: [],
            liveToolCalls: [],
            isComplete: true,
            isStreaming: false,
          },
          createdAt: userMsg.created_at,
        } as ConversationTurn;
      });

      // Merge turns (older first, then existing)
      const allTurns = [...olderTurns, ...state.turns];

      // Deduplicate and sort
      const uniqueTurns = Array.from(
        new Map(allTurns.map(t => [t.id, t])).values()
      ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Update cache
      setTurnsInCache(state.currentNodeId, uniqueTurns);

      const legacyMessages = flattenTurnsToMessages(uniqueTurns, state.orphanAgentMessages);

      set({
        turns: uniqueTurns,
        _legacyMessages: legacyMessages,
        isLoadingOlderTurns: false,
        hasOlderTurns: hasMore,
      });

    } catch {
      set({ isLoadingOlderTurns: false });
    }
  },

  sendMessage: async (
    content: string,
    messageType: MessageType = 'text',
    metadata?: Record<string, unknown>
  ) => {
    const state = get();
    if (!state.currentWorkspaceId) {
      set({ error: 'No workspace selected' });
      return null;
    }

    try {
      const result = await safeInvoke<CommandResult<Message>>('send_message', {
        workspaceId: state.currentWorkspaceId,
        nodeId: state.currentNodeId,
        content,
        messageType,
        senderType: 'human' as SenderType,
        senderId: null,
        metadata: metadata || null,
      });

      if (result && result.success && result.data) {
        const newMessage = result.data;

        // Add as a new turn
        get().addTurnFromUserMessage(newMessage);

        // Update cache
        if (state.currentNodeId) {
          appendTurnToCache(state.currentNodeId, {
            id: newMessage.id,
            userMessage: newMessage,
            agentResponse: {
              messages: [],
              liveBlocks: [],
              liveToolCalls: [],
              isComplete: false,
              isStreaming: false,
            },
            createdAt: newMessage.created_at,
          });
        }

        // Update node's last_active_at
        if (state.currentNodeId) {
          const { useNodeStore } = await import('./nodeStore');
          useNodeStore.getState().updateLastActiveAt(state.currentNodeId);
        }

        return newMessage;
      } else {
        set({ error: result?.error || 'Failed to send message' });
        return null;
      }
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  fetchChatState: async (workspaceId: string, nodeId: string | null) => {
    try {
      const result = await safeInvoke<CommandResult<ChatStateEntry>>('get_chat_state', {
        workspaceId,
        nodeId,
      });
      if (result?.success && result?.data) {
        set({ chatState: result?.data });
      }
    } catch (err) {
      console.error('Failed to fetch chat state:', err);
    }
  },

  setChatState: async (state: ChatStateType, lockedReason?: string) => {
    const currentState = get();
    if (!currentState.currentWorkspaceId) {
      return;
    }

    try {
      const result = await safeInvoke<CommandResult<ChatStateEntry>>('set_chat_state', {
        workspaceId: currentState.currentWorkspaceId,
        nodeId: currentState.currentNodeId,
        state,
        lockedReason: lockedReason || null,
      });
      if (result?.success && result?.data) {
        set({ chatState: result?.data });
      }
    } catch (err) {
      console.error('Failed to set chat state:', err);
    }
  },

  refreshLatestTurn: async () => {
    const state = get();
    if (!state.currentWorkspaceId) return;

    const latestTurn = state.turns[state.turns.length - 1];
    if (!latestTurn) return;

    try {
      // Fetch fresh agent messages for the latest turn
      const agentResult = await safeInvoke<CommandResult<Message[]>>('get_agent_messages_for_turn', {
        workspaceId: state.currentWorkspaceId,
        nodeId: state.currentNodeId,
        afterMessageId: latestTurn.id,
        limit: AGENT_MESSAGE_LIMIT,
      });

      if (agentResult?.success && agentResult.data) {
        get().updateTurnWithAgentMessages(latestTurn.id, agentResult.data);
      }
    } catch (err) {
      console.error('Failed to refresh latest turn:', err);
    }
  },

  addTurnFromUserMessage: (message: Message) => {
    set((state) => {
      // Check if turn already exists
      if (state.turns.some(t => t.id === message.id)) {
        return state;
      }

      const newTurn: ConversationTurn = {
        id: message.id,
        userMessage: message,
        agentResponse: {
          messages: [],
          liveBlocks: [],
          liveToolCalls: [],
          isComplete: false,
          isStreaming: false,
        },
        createdAt: message.created_at,
      };

      const newTurns = [...state.turns, newTurn];
      const legacyMessages = flattenTurnsToMessages(newTurns, state.orphanAgentMessages);

      return {
        turns: newTurns,
        _legacyMessages: legacyMessages,
      };
    });
  },

  updateTurnWithAgentMessages: (turnId: string, agentMessages: Message[]) => {
    set((state) => {
      const turnIndex = state.turns.findIndex(t => t.id === turnId);
      if (turnIndex === -1) return state;

      const updatedTurns = [...state.turns];
      updatedTurns[turnIndex] = {
        ...updatedTurns[turnIndex],
        agentResponse: {
          ...updatedTurns[turnIndex].agentResponse,
          messages: agentMessages,
          isComplete: true,
        },
      };

      // Update cache
      if (state.currentNodeId) {
        updateTurnAgentMessages(state.currentNodeId, turnId, agentMessages);
      }

      const legacyMessages = flattenTurnsToMessages(updatedTurns, state.orphanAgentMessages);

      return {
        turns: updatedTurns,
        _legacyMessages: legacyMessages,
      };
    });
  },

  getTurnById: (turnId: string) => {
    return get().turns.find(t => t.id === turnId);
  },

  getLatestTurn: () => {
    const turns = get().turns;
    return turns[turns.length - 1];
  },

  // Legacy compatibility methods
  addMessage: (message: Message) => {
    // For backward compatibility: if it's a human message, add as turn
    // If it's an agent message, add to the latest turn
    if (message.sender_type === 'human') {
      get().addTurnFromUserMessage(message);
    } else {
      // Add to latest turn's agent messages
      set((state) => {
        if (state.turns.length === 0) {
          // No turns yet - add as orphan
          const orphan = state.orphanAgentMessages || {
            messages: [],
            liveBlocks: [],
            liveToolCalls: [],
          };
          return {
            orphanAgentMessages: {
              ...orphan,
              messages: [...orphan.messages, message],
            },
          };
        }

        const updatedTurns = [...state.turns];
        const lastTurn = updatedTurns[updatedTurns.length - 1];

        // Check if message already exists
        if (lastTurn.agentResponse.messages.some(m => m.id === message.id)) {
          return state;
        }

        updatedTurns[updatedTurns.length - 1] = {
          ...lastTurn,
          agentResponse: {
            ...lastTurn.agentResponse,
            messages: [...lastTurn.agentResponse.messages, message],
          },
        };

        const legacyMessages = flattenTurnsToMessages(updatedTurns, state.orphanAgentMessages);

        return {
          turns: updatedTurns,
          _legacyMessages: legacyMessages,
        };
      });
    }
  },

  clearMessages: () => {
    const state = get();
    if (state.currentNodeId) {
      invalidateTurns(state.currentNodeId);
    }
    set({
      turns: [],
      orphanAgentMessages: null,
      _legacyMessages: [],
      chatState: null,
    });
  },
}));

/**
 * Helper function to flatten turns back into a messages array
 * Used for backward compatibility and legacy message cache
 */
function flattenTurnsToMessages(
  turns: ConversationTurn[],
  orphans?: OrphanAgentMessages | null
): Message[] {
  const messages: Message[] = [];

  // Add orphan messages first
  if (orphans) {
    messages.push(...orphans.messages);
  }

  // Add all turn messages in order
  for (const turn of turns) {
    messages.push(turn.userMessage);
    messages.push(...turn.agentResponse.messages);
  }

  return messages;
}
