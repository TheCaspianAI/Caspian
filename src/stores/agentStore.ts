import { create } from 'zustand';
import { emit } from '@tauri-apps/api/event';
import { safeInvoke, safeListen } from '../utils/tauri';
import { stripContextMarkers } from '../utils/contextUtils';
import { useUIStore } from './uiStore';

type UnlistenFn = () => void;
import type {
  CommandResult,
  AgentSession,
  AgentAdapterType,
  AgentOutputEvent,
  LiveToolCall,
  LiveBlock,
  StructuredEvent,
  UserInputRequest,
  UserInputSelection,
} from '../types';

interface AgentCompleteEvent {
  session_id: string;
  node_id: string;
  success: boolean;
  message?: string;
  node_name?: string;
  node_context?: string;
}

// Track user input state
interface PendingUserInput {
  request: UserInputRequest;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submittedSelection?: UserInputSelection;
}

// Cache TTL for agent status (30 seconds fresh)
const AGENT_STATUS_FRESH_TTL = 30_000;

interface AgentStoreState {
  // State - simplified, backend is source of truth
  availableAdapters: AgentAdapterType[];
  outputBuffer: Record<string, AgentOutputEvent[]>;
  isLoading: boolean;
  error: string | null;

  // Status cache - refreshed from backend
  nodeStatus: Record<string, AgentSession | null>;
  // Timestamp when each nodeStatus was last fetched (for TTL caching)
  nodeStatusFetchedAt: Record<string, number>;

  // Live tool call tracking (per node)
  liveToolCalls: Record<string, LiveToolCall[]>;
  liveBlocks: Record<string, LiveBlock[]>;

  // Turn completion timestamps (for delayed collapse of thinking blocks)
  turnCompletedAt: Record<string, number | null>;

  // Pending user input requests (per node)
  pendingUserInput: Record<string, PendingUserInput | null>;

  // Subscription management
  isSubscribed: boolean;
  unlistenFns: UnlistenFn[];

  // Actions
  fetchAvailableAdapters: () => Promise<void>;
  spawnAgent: (
    workspaceId: string,
    nodeId: string,
    adapterType: AgentAdapterType,
    goal: string,
    workingDir: string,
    context?: string,
    attachments?: Array<{ name: string; type: string; size: number; content?: string }>,
    model?: string,
    agentMode?: string
  ) => Promise<AgentSession | null>;
  terminateAgent: (sessionId: string) => Promise<boolean>;
  terminateAgentForNode: (nodeId: string) => Promise<boolean>;

  // Status queries - always fetches from backend (source of truth)
  getAgentStatus: (nodeId: string) => Promise<AgentSession | null>;
  getAgentStatusesBatch: (nodeIds: string[]) => Promise<void>;
  refreshNodeStatus: (nodeId: string) => Promise<void>;

  getOutputForNode: (nodeId: string) => AgentOutputEvent[];
  clearOutputForNode: (nodeId: string) => void;

  // Live tool call accessors
  getLiveToolCallsForNode: (nodeId: string) => LiveToolCall[];
  getLiveBlocksForNode: (nodeId: string) => LiveBlock[];
  clearLiveDataForNode: (nodeId: string) => void;

  // Turn completion tracking (for thinking block collapse timing)
  getTurnCompletedAt: (nodeId: string) => number | null;
  setTurnCompletedAt: (nodeId: string, timestamp: number | null) => void;
  clearTurnCompletedAt: (nodeId: string) => void;

  // User input handling
  getPendingUserInputForNode: (nodeId: string) => PendingUserInput | null;
  restorePendingUserInput: (nodeId: string) => Promise<boolean>;
  submitUserSelection: (
    nodeId: string,
    workspaceId: string,
    workingDir: string,
    selection: UserInputSelection
  ) => Promise<boolean>;
  dismissUserInput: (nodeId: string) => void;

  // Event subscriptions
  subscribeToOutput: () => Promise<void>;
  unsubscribeFromOutput: () => void;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  availableAdapters: [],
  outputBuffer: {},
  isLoading: false,
  error: null,
  nodeStatus: {},
  nodeStatusFetchedAt: {},
  liveToolCalls: {},
  liveBlocks: {},
  turnCompletedAt: {},
  pendingUserInput: {},
  isSubscribed: false,
  unlistenFns: [],

  fetchAvailableAdapters: async () => {
    try {
      const result = await safeInvoke<CommandResult<string[]>>('get_available_adapters');
      if (result?.success && result?.data) {
        set({ availableAdapters: result?.data as AgentAdapterType[] });
      }
    } catch (err) {
      console.error('Failed to fetch available adapters:', err);
    }
  },

  spawnAgent: async (workspaceId, nodeId, adapterType, goal, workingDir, context, attachments, model, agentMode) => {
    set({ isLoading: true, error: null });
    try {
      const result = await safeInvoke<CommandResult<AgentSession>>('spawn_agent', {
        workspaceId,
        nodeId,
        adapterType,
        goal,
        workingDir,
        context: context || null,
        attachments: attachments || null,
        model: model || null,
        agentMode: agentMode || null,
      });
      if (result && result.success && result.data) {
        // Update local status cache and clear any previous turn completion timestamp
        set((state) => {
          const newTurnCompletedAt = { ...state.turnCompletedAt };
          delete newTurnCompletedAt[nodeId]; // Clear previous turn's completion time
          return {
            nodeStatus: {
              ...state.nodeStatus,
              [nodeId]: result.data!,
            },
            nodeStatusFetchedAt: {
              ...state.nodeStatusFetchedAt,
              [nodeId]: Date.now(),
            },
            turnCompletedAt: newTurnCompletedAt,
            isLoading: false,
          };
        });

        return result.data;
      } else {
        const errorMsg = result?.error || 'Failed to spawn agent';
        set({ error: errorMsg, isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  terminateAgent: async (sessionId) => {
    try {
      const result = await safeInvoke<CommandResult<void>>('terminate_agent', {
        sessionId,
      });
      if (result && result.success) {
        return true;
      } else {
        const errorMsg = result?.error || 'Failed to terminate agent';
        set({ error: errorMsg });
        return false;
      }
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },

  terminateAgentForNode: async (nodeId) => {
    try {
      const result = await safeInvoke<CommandResult<void>>('terminate_agent_for_node', {
        nodeId,
      });
      if (result && result.success) {
        // Refresh status from backend
        await get().refreshNodeStatus(nodeId);
        return true;
      } else {
        const errorMsg = result?.error || 'Failed to terminate agent';
        set({ error: errorMsg });
        return false;
      }
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },

  // Query backend for status with TTL caching
  getAgentStatus: async (nodeId) => {
    const state = get();
    const cachedStatus = state.nodeStatus[nodeId];
    const fetchedAt = state.nodeStatusFetchedAt[nodeId];

    // Check if cached data is still fresh
    if (fetchedAt && (Date.now() - fetchedAt) < AGENT_STATUS_FRESH_TTL) {
      // Return cached data without hitting backend
      return cachedStatus;
    }

    // Cache miss or stale - fetch from backend
    try {
      const result = await safeInvoke<CommandResult<AgentSession | null>>('get_agent_status', {
        nodeId,
      });
      if (result && result.success) {
        const session = result.data || null;
        // Update cache with timestamp
        set((state) => ({
          nodeStatus: {
            ...state.nodeStatus,
            [nodeId]: session,
          },
          nodeStatusFetchedAt: {
            ...state.nodeStatusFetchedAt,
            [nodeId]: Date.now(),
          },
        }));
        return session;
      }
      return cachedStatus; // Return stale cache on error
    } catch (err) {
      console.error('Failed to get agent status:', err);
      return cachedStatus; // Return stale cache on error
    }
  },

  // Batch query for multiple nodes (avoids N+1 problem)
  getAgentStatusesBatch: async (nodeIds) => {
    if (nodeIds.length === 0) return;

    try {
      const result = await safeInvoke<CommandResult<AgentSession[]>>('get_agent_statuses_batch', {
        nodeIds,
      });
      if (result && result.success && result.data) {
        // Update cache for all returned sessions
        const sessionsMap: Record<string, AgentSession | null> = {};
        const timestampsMap: Record<string, number> = {};
        const now = Date.now();

        // Initialize all requested nodeIds as null (no session) with timestamp
        nodeIds.forEach(id => {
          sessionsMap[id] = null;
          timestampsMap[id] = now;
        });

        // Override with actual session data
        result.data.forEach(session => {
          sessionsMap[session.node_id] = session;
        });

        set((state) => ({
          nodeStatus: {
            ...state.nodeStatus,
            ...sessionsMap,
          },
          nodeStatusFetchedAt: {
            ...state.nodeStatusFetchedAt,
            ...timestampsMap,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to get agent statuses batch:', err);
    }
  },

  refreshNodeStatus: async (nodeId) => {
    await get().getAgentStatus(nodeId);
  },

  getOutputForNode: (nodeId) => {
    return get().outputBuffer[nodeId] || [];
  },

  clearOutputForNode: (nodeId) => {
    set((state) => {
      const newBuffer = { ...state.outputBuffer };
      delete newBuffer[nodeId];
      return { outputBuffer: newBuffer };
    });
  },

  getLiveToolCallsForNode: (nodeId) => {
    return get().liveToolCalls[nodeId] || [];
  },

  getLiveBlocksForNode: (nodeId) => {
    return get().liveBlocks[nodeId] || [];
  },

  clearLiveDataForNode: (nodeId) => {
    set((state) => {
      const newToolCalls = { ...state.liveToolCalls };
      const newBlocks = { ...state.liveBlocks };
      const newPendingInput = { ...state.pendingUserInput };
      delete newToolCalls[nodeId];
      delete newBlocks[nodeId];
      delete newPendingInput[nodeId];
      return {
        liveToolCalls: newToolCalls,
        liveBlocks: newBlocks,
        pendingUserInput: newPendingInput,
      };
    });
  },

  getTurnCompletedAt: (nodeId) => {
    return get().turnCompletedAt[nodeId] || null;
  },

  setTurnCompletedAt: (nodeId, timestamp) => {
    set((state) => ({
      turnCompletedAt: {
        ...state.turnCompletedAt,
        [nodeId]: timestamp,
      },
    }));
  },

  clearTurnCompletedAt: (nodeId) => {
    set((state) => {
      const newTurnCompletedAt = { ...state.turnCompletedAt };
      delete newTurnCompletedAt[nodeId];
      return { turnCompletedAt: newTurnCompletedAt };
    });
  },

  getPendingUserInputForNode: (nodeId) => {
    return get().pendingUserInput[nodeId] || null;
  },

  restorePendingUserInput: async (nodeId) => {
    // Check if already have pending input for this node
    if (get().pendingUserInput[nodeId]) {
      return true;
    }

    try {
      // Query backend for persisted pending user input
      const result = await safeInvoke<CommandResult<{
        tool_id: string;
        question: string;
        header?: string;
        options: Array<{ label: string; description?: string }>;
        multi_select: boolean;
        message_id: string;
      } | null>>('get_pending_user_input', { nodeId });

      if (result?.success && result?.data) {
        const data = result.data;
        // Restore the pending user input state
        set((state) => ({
          pendingUserInput: {
            ...state.pendingUserInput,
            [nodeId]: {
              request: {
                tool_id: data.tool_id,
                question: data.question,
                header: data.header,
                options: data.options,
                multi_select: data.multi_select,
                message_id: data.message_id,
              },
              isSubmitting: false,
              isSubmitted: false,
            },
          },
        }));
        console.log('[agentStore] Restored pending user input for node:', nodeId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[agentStore] Failed to restore pending user input:', err);
      return false;
    }
  },

  submitUserSelection: async (nodeId, workspaceId, workingDir, selection) => {
    // Mark as submitting
    set((state) => ({
      pendingUserInput: {
        ...state.pendingUserInput,
        [nodeId]: state.pendingUserInput[nodeId]
          ? { ...state.pendingUserInput[nodeId]!, isSubmitting: true }
          : null,
      },
    }));

    try {
      // Get the current session to resume
      const currentSession = get().nodeStatus[nodeId];
      if (!currentSession) {
        console.error('No session found for node:', nodeId);
        return false;
      }

      // Format the selection as a user message for the resume
      let selectionMessage: string;

      if (Array.isArray(selection.selectedIndex)) {
        // Multi-select formatting
        const labels = Array.isArray(selection.selectedLabel)
          ? selection.selectedLabel
          : [selection.selectedLabel];

        const indices = selection.selectedIndex;

        if (labels.includes('Other') && Array.isArray(selection.selectedDescription)) {
          // Handle "Other" mixed with regular options
          const regularOptions = indices
            .filter((_, i) => labels[i] !== 'Other')
            .map((idx, i) => `option ${idx + 1}: "${labels[i]}"`);
          const customInputs = selection.selectedDescription.filter(Boolean);

          const parts = [...regularOptions, ...customInputs.map(desc => `"${desc}"`)];
          selectionMessage = `User selected: ${parts.join(', ')}`;
        } else {
          // All regular options
          const optionsList = indices
            .map((_, i) => `option ${indices[i] + 1}: "${labels[i]}"`)
            .join(', ');
          selectionMessage = `User selected: ${optionsList}`;
        }
      } else {
        // Single-select (existing logic)
        selectionMessage = selection.selectedLabel === 'Other' && selection.selectedDescription
          ? String(selection.selectedDescription)
          : `User selected option ${selection.selectedIndex + 1}: "${selection.selectedLabel}"`;
      }

      // Get the selected model from UI store
      const selectedModel = useUIStore.getState().selectedModel;

      // Call the resume_agent_with_input command
      const result = await safeInvoke<CommandResult<AgentSession>>('resume_agent_with_input', {
        workspaceId,
        nodeId,
        sessionId: currentSession.id,
        workingDir,
        userInput: selectionMessage,
        model: selectedModel || null,
      });

      if (result && result.success && result.data) {
        // Mark as submitted (UI will hide based on isSubmitted flag)
        // We keep the entry instead of deleting to prevent race condition where
        // incoming user_input_request events could recreate the pending input
        set((state) => ({
          pendingUserInput: {
            ...state.pendingUserInput,
            [nodeId]: state.pendingUserInput[nodeId]
              ? {
                  ...state.pendingUserInput[nodeId]!,
                  isSubmitting: false,
                  isSubmitted: true,
                  submittedSelection: selection,
                }
              : null,
          },
          nodeStatus: {
            ...state.nodeStatus,
            [nodeId]: result.data!,
          },
          nodeStatusFetchedAt: {
            ...state.nodeStatusFetchedAt,
            [nodeId]: Date.now(),
          },
        }));

        return true;
      } else {
        // Reset submitting state on error
        set((state) => ({
          pendingUserInput: {
            ...state.pendingUserInput,
            [nodeId]: state.pendingUserInput[nodeId]
              ? { ...state.pendingUserInput[nodeId]!, isSubmitting: false }
              : null,
          },
          error: result?.error || 'Failed to resume agent',
        }));
        return false;
      }
    } catch (err) {
      console.error('Failed to submit user selection:', err);
      set((state) => ({
        pendingUserInput: {
          ...state.pendingUserInput,
          [nodeId]: state.pendingUserInput[nodeId]
            ? { ...state.pendingUserInput[nodeId]!, isSubmitting: false }
            : null,
        },
        error: String(err),
      }));
      return false;
    }
  },

  dismissUserInput: (nodeId) => {
    set((state) => {
      const newPendingInput = { ...state.pendingUserInput };
      delete newPendingInput[nodeId];
      return { pendingUserInput: newPendingInput };
    });
  },

  subscribeToOutput: async () => {
    // Guard: only subscribe once
    if (get().isSubscribed) {
      return;
    }

    // Set isSubscribed immediately to prevent race condition
    set({ isSubscribed: true });

    // Clear any stale listeners (non-blocking to avoid main thread blocking)
    const { unlistenFns } = get();
    if (unlistenFns.length > 0) {
      set({ unlistenFns: [] });
      // Defer cleanup to not block main thread
      queueMicrotask(() => {
        unlistenFns.forEach((fn) => fn());
      });
    }

    // Subscribe to global agent output events
    const outputUnlisten = await safeListen<AgentOutputEvent>('agent:output', (payload) => {
      set((state) => {
        const nodeId = payload.node_id;
        const existing = state.outputBuffer[nodeId] || [];

        // Deduplication check: skip if output with same session_id, timestamp, and content exists
        const isDuplicate = existing.some(
          o => o.session_id === payload.session_id
            && o.timestamp === payload.timestamp
            && o.content === payload.content
        );

        if (isDuplicate) {
          return state; // No change if duplicate
        }

        const currentStatus = state.nodeStatus[nodeId];
        let updatedNodeStatus = state.nodeStatus;
        let updatedToolCalls = state.liveToolCalls;
        let updatedBlocks = state.liveBlocks;
        let updatedPendingInput = state.pendingUserInput;
        let hasUserInputRequest = false;

        // Process structured events FIRST to check for user input request
        if (payload.structured) {
          const result = processStructuredEvent(
            payload.structured,
            state.liveToolCalls[nodeId] || [],
            state.liveBlocks[nodeId] || []
          );
          updatedToolCalls = {
            ...state.liveToolCalls,
            [nodeId]: result.toolCalls,
          };
          updatedBlocks = {
            ...state.liveBlocks,
            [nodeId]: result.blocks,
          };

          // If there's a user input request, set pending status
          // BUT skip if we already have a submitted input for this node (prevents race condition)
          if (result.userInputRequest) {
            const existingInput = state.pendingUserInput[nodeId];
            const alreadySubmitted = existingInput?.isSubmitted === true;

            if (!alreadySubmitted) {
              hasUserInputRequest = true;
              updatedPendingInput = {
                ...state.pendingUserInput,
                [nodeId]: {
                  request: result.userInputRequest,
                  isSubmitting: false,
                  isSubmitted: false,
                },
              };

              // Set status to 'pending' for user input request
              if (currentStatus) {
                updatedNodeStatus = {
                  ...state.nodeStatus,
                  [nodeId]: { ...currentStatus, status: 'pending' },
                };
              }
            }
          }
        }

        // Only set to 'running' if NOT a user input request and NOT already pending
        // The 'pending' status means agent is waiting for user input - don't overwrite it
        if (!hasUserInputRequest && currentStatus &&
            currentStatus.status !== 'running' &&
            currentStatus.status !== 'pending' &&
            payload.output_type === 'stdout') {
          updatedNodeStatus = {
            ...state.nodeStatus,
            [nodeId]: { ...currentStatus, status: 'running' },
          };
        }

        // Emit event for needs_input state change (for notifications)
        if (hasUserInputRequest) {
          // Get node name for the notification - check multiple sources
          import('./nodeStore').then(({ useNodeStore }) => {
            const nodeStore = useNodeStore.getState();
            // Try current repo's nodes first (more likely to be populated)
            let node = nodeStore.nodes.find(n => n.id === nodeId);
            // Fall back to allNodes (cross-repo list)
            if (!node) {
              node = nodeStore.allNodes.find(n => n.id === nodeId);
            }
            // Also check activeNodeState
            if (!node && nodeStore.activeNodeState.status === 'ready' && nodeStore.activeNodeState.nodeId === nodeId) {
              node = nodeStore.activeNodeState.node.node;
            }
            const nodeName = node?.context || node?.display_name || 'Node';
            emit('node:state-change', {
              node_id: nodeId,
              node_name: nodeName,
              previous_state: 'agent_running',
              new_state: 'needs_input',
              timestamp: new Date().toISOString(),
            });
          });
        }

        // Update timestamp if nodeStatus was modified
        const updatedTimestamps = updatedNodeStatus !== state.nodeStatus
          ? { ...state.nodeStatusFetchedAt, [nodeId]: Date.now() }
          : state.nodeStatusFetchedAt;

        return {
          nodeStatus: updatedNodeStatus,
          nodeStatusFetchedAt: updatedTimestamps,
          liveToolCalls: updatedToolCalls,
          liveBlocks: updatedBlocks,
          pendingUserInput: updatedPendingInput,
          outputBuffer: {
            ...state.outputBuffer,
            [nodeId]: [...existing, payload],
          },
        };
      });
    });

    // Subscribe to agent completion events
    const completeUnlisten = await safeListen<AgentCompleteEvent>('agent:complete', async (payload) => {
      const nodeId = payload.node_id;

      // Mark that this node's agent has completed
      set((state) => ({
        nodeStatus: {
          ...state.nodeStatus,
          [nodeId]: state.nodeStatus[nodeId]
            ? { ...state.nodeStatus[nodeId]!, status: 'completed_pending_context' as const }
            : null,
        },
        nodeStatusFetchedAt: {
          ...state.nodeStatusFetchedAt,
          [nodeId]: Date.now(),
        },
      }));

      // Emit node:state-change event for notification
      // Backend extracts and updates context before emitting, so this shows the NEW name
      const nodeName = payload.node_context || payload.node_name || 'Node';
      emit('node:state-change', {
        node_id: nodeId,
        node_name: nodeName,
        previous_state: 'agent_running',
        new_state: 'idle',
        timestamp: new Date().toISOString(),
      });
    });

    set({
      unlistenFns: [outputUnlisten, completeUnlisten] as UnlistenFn[],
    });
  },

  unsubscribeFromOutput: () => {
    const { unlistenFns } = get();
    // Clear state immediately so new subscriptions can proceed
    set({ unlistenFns: [], isSubscribed: false });
    // Defer actual unlisten calls to not block main thread
    // This prevents 2+ second lag on re-navigation caused by blocking Tauri unlisten
    queueMicrotask(() => {
      unlistenFns.forEach((unlisten) => unlisten());
    });
  },
}));

/**
 * Process a structured event and update tool calls and blocks
 * Optimized to only create new arrays when modifications are actually made
 */
function processStructuredEvent(
  event: StructuredEvent,
  existingToolCalls: LiveToolCall[],
  existingBlocks: LiveBlock[]
): { toolCalls: LiveToolCall[]; blocks: LiveBlock[]; userInputRequest?: UserInputRequest } {
  // Start with existing arrays - only copy when we need to modify
  let toolCalls = existingToolCalls;
  let blocks = existingBlocks;
  let userInputRequest: UserInputRequest | undefined;

  switch (event.event_type) {
    case 'thinking': {
      // Create a thinking block to signal the agent is processing
      if (event.message_id) {
        const existingThinkingBlock = existingBlocks.find(
          b => b.type === 'thinking' && b.messageId === event.message_id
        );
        if (!existingThinkingBlock) {
          // Only copy array when actually adding
          blocks = [...existingBlocks, {
            id: `thinking-${event.message_id}`,
            type: 'thinking' as const,
            content: event.content || '',
            messageId: event.message_id,
            streamingState: 'streaming' as const,
          }];
        }
      }
      break;
    }

    case 'tool_start': {
      if (event.tool_id && event.tool_name && event.message_id) {
        const newToolCall: LiveToolCall = {
          id: event.tool_id,
          name: event.tool_name,
          input: event.tool_input || {},
          status: 'running',
          startedAt: Date.now(),
          isError: false,
          messageId: event.message_id,
        };
        // Copy arrays when adding new items
        toolCalls = [...existingToolCalls, newToolCall];
        blocks = [...existingBlocks, {
          id: `tool-${event.tool_id}`,
          type: 'tool_use' as const,
          content: event.tool_name,
          messageId: event.message_id,
          toolCall: newToolCall,
          streamingState: 'streaming' as const,
        }];
      }
      break;
    }

    case 'tool_complete': {
      if (event.tool_id) {
        const index = existingToolCalls.findIndex((tc) => tc.id === event.tool_id);
        if (index >= 0) {
          const now = Date.now();
          const newStatus = event.is_error ? 'error' as const : 'completed' as const;
          const updatedToolCall = {
            ...existingToolCalls[index],
            status: newStatus,
            completedAt: now,
            duration: event.duration_ms || (now - existingToolCalls[index].startedAt),
            output: event.tool_output,
            isError: event.is_error || false,
          };
          // Copy and update tool calls array
          toolCalls = [...existingToolCalls];
          toolCalls[index] = updatedToolCall;

          // Update the block's toolCall reference
          const blockIndex = existingBlocks.findIndex((b) => b.toolCall?.id === event.tool_id);
          if (blockIndex >= 0) {
            blocks = [...existingBlocks];
            blocks[blockIndex] = {
              ...existingBlocks[blockIndex],
              toolCall: updatedToolCall,
              streamingState: 'complete' as const,
            };
          }
        }
      }
      break;
    }

    case 'text': {
      if (event.content && event.message_id) {
        const cleanedContent = stripContextMarkers(event.content);
        if (cleanedContent) {
          // Find existing text block by messageId (not content) to UPDATE it
          // This keeps the block ID stable as content grows during streaming
          const existingIndex = existingBlocks.findIndex(
            b => b.type === 'text' && b.messageId === event.message_id
          );

          if (existingIndex >= 0) {
            // UPDATE existing block - keep same ID to prevent animation restart
            const existingBlock = existingBlocks[existingIndex];
            if (existingBlock.content !== cleanedContent) {
              blocks = [...existingBlocks];
              blocks[existingIndex] = {
                ...existingBlock,
                content: cleanedContent,
              };
            }
            // If content is the same, no change needed
          } else {
            // CREATE new block with stable ID based on messageId
            blocks = [...existingBlocks, {
              id: `text-${event.message_id}`,
              type: 'text' as const,
              content: cleanedContent,
              messageId: event.message_id,
              streamingState: 'streaming' as const,
            }];
          }
        }
      }
      break;
    }

    case 'user_input_request': {
      if (event.tool_id && event.question && event.options && event.message_id) {
        userInputRequest = {
          tool_id: event.tool_id,
          question: event.question,
          header: event.header,
          options: event.options,
          multi_select: event.multi_select || false,
          message_id: event.message_id,
        };
      }
      // No array modifications needed
      break;
    }

    case 'complete': {
      // Check if any modifications are needed before copying arrays
      const hasRunningTools = existingToolCalls.some(tc => tc.status === 'running');
      const hasIncompleteBlocks = existingBlocks.some(b => b.streamingState !== 'complete');

      if (hasRunningTools) {
        toolCalls = existingToolCalls.map(tc =>
          tc.status === 'running'
            ? { ...tc, status: 'completed' as const, completedAt: Date.now() }
            : tc
        );
      }

      if (hasIncompleteBlocks) {
        blocks = existingBlocks.map(b =>
          b.streamingState !== 'complete'
            ? { ...b, streamingState: 'complete' as const }
            : b
        );
      }
      break;
    }
  }

  return { toolCalls, blocks, userInputRequest };
}
