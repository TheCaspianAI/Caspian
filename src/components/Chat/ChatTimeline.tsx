import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/chatStore';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore } from '../../stores/nodeStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { useAgentActivityState } from '../../hooks/useAgentActivityState';
import { useNodeActions } from '../../hooks/useNodeActions';
import { processFilePathsToAttachments } from '../../utils/fileUtils';
import { MessageBubble } from './MessageBubble';
import { EnhancedChatInput } from './EnhancedChatInput';
import { AgentTurnRenderer } from './AgentTurnRenderer';
import { UserInputBlock } from './UserInputBlock';
import type { Attachment, UserInputSelection, ConversationTurn } from '../../types';
import { useShallow } from 'zustand/react/shallow';

// Regex to match context marker - captures a short phrase (2-6 words)
const CONTEXT_REGEX = /\[CONTEXT:\s*([^\]]+)\]/gi;

interface AgentCompleteEvent {
  session_id: string;
  node_id: string;
  success: boolean;
  message?: string;
  node_name?: string;
  node_context?: string;
}

export function ChatTimeline() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Track message count to only scroll when new messages arrive (not on content updates)
  const prevMessageCountRef = useRef(0);
  // Track scroll position for preserving when prepending older turns
  const prevScrollHeightRef = useRef(0);
  const justPrependedRef = useRef(false);
  const prevTurnCountRef = useRef(0);

  // Track the last context we set up to avoid duplicate effect runs
  const lastContextRef = useRef<{ repoId: string | null; nodeId: string | null }>({ repoId: null, nodeId: null });

  // CONSOLIDATED SELECTORS: Use useShallow to reduce re-renders from object/array changes
  // Combine related selectors to minimize subscription count
  const { activeRepoId, activeRepo } = useRepositoryStore(
    useShallow(state => ({
      activeRepoId: state.activeRepoId,
      activeRepo: state.repositories.find(r => r.id === state.activeRepoId),
    }))
  );

  // OPTIMIZATION: Consolidate node store subscriptions into single selector
  // This reduces from 4 subscriptions to 1, preventing cascade re-renders
  const { activeNodeId, activeNode, isNodeLoading, updateNodeContext } = useNodeStore(
    useShallow(state => ({
      activeNodeId: state.activeNodeState?.status !== 'none' ? state.activeNodeState?.nodeId ?? null : null,
      activeNode: state.activeNodeState?.status === 'ready' ? state.activeNodeState.node : null,
      isNodeLoading: state.activeNodeState?.status === 'loading',
      updateNodeContext: state.updateNodeContext,
    }))
  );

  // Use actions hook for fresh state access in callbacks (prevents stale closure bugs)
  const { canSendMessage } = useNodeActions();

  // Chat store - consolidated selector with shallow comparison
  // Now using turns instead of messages for the separated streams architecture
  const { turns, isLoading, isLoadingOlderTurns, hasOlderTurns, error, sendMessage, fetchOlderTurns } = useChatStore(
    useShallow(state => ({
      turns: state.turns,
      isLoading: state.isLoading,
      isLoadingOlderTurns: state.isLoadingOlderTurns,
      hasOlderTurns: state.hasOlderTurns,
      error: state.error,
      sendMessage: state.sendMessage,
      fetchOlderTurns: state.fetchOlderTurns,
    }))
  );

  // Agent store - get full state objects and derive node-specific data
  // NOTE: We can't use activeNodeId in the selector as it causes infinite loops
  // Instead, we get the full maps and derive in useMemo below
  const nodeStatus = useAgentStore(state => state.nodeStatus);
  const liveToolCalls = useAgentStore(state => state.liveToolCalls);
  const liveBlocks = useAgentStore(state => state.liveBlocks);
  const pendingUserInputMap = useAgentStore(state => state.pendingUserInput);

  // Actions are stable references - get them once
  const agentActions = useAgentStore(
    useShallow(state => ({
      subscribeToOutput: state.subscribeToOutput,
      unsubscribeFromOutput: state.unsubscribeFromOutput,
      spawnAgent: state.spawnAgent,
      restorePendingUserInput: state.restorePendingUserInput,
      submitUserSelection: state.submitUserSelection,
      dismissUserInput: state.dismissUserInput,
      refreshNodeStatus: state.refreshNodeStatus,
      clearLiveDataForNode: state.clearLiveDataForNode,
    }))
  );
  const {
    subscribeToOutput,
    unsubscribeFromOutput,
    spawnAgent,
    restorePendingUserInput,
    submitUserSelection,
    dismissUserInput,
    refreshNodeStatus,
    clearLiveDataForNode,
  } = agentActions;

  // Derive node-specific data from the maps (memoized to prevent recalc)
  const currentNodeStatus = activeNodeId ? nodeStatus[activeNodeId] || null : null;
  const liveToolCallsFromStore = useMemo(
    () => activeNodeId ? liveToolCalls[activeNodeId] || [] : [],
    [activeNodeId, liveToolCalls]
  );
  const liveBlocksFromStore = useMemo(
    () => activeNodeId ? liveBlocks[activeNodeId] || [] : [],
    [activeNodeId, liveBlocks]
  );
  const pendingUserInput = activeNodeId ? pendingUserInputMap[activeNodeId] || null : null;

  const isAgentRunning = currentNodeStatus?.status === 'running';

  // Track agent activity state for visual indicators
  const { isStreaming } = useAgentActivityState(activeNodeId);

  // Turns now come directly from the store (separated message streams architecture)
  // This ensures user messages are ALWAYS visible, even when there are many tool calls
  // The store handles the grouping, so we just merge in live data for the latest turn

  // Merge live streaming data into turns for display
  const turnsWithLiveData = useMemo((): ConversationTurn[] => {
    if (turns.length === 0) return [];

    // If agent is not running, just return turns as-is
    if (!isAgentRunning) return turns;

    // For the latest turn, merge in live streaming data
    const updatedTurns = [...turns];
    const lastIndex = updatedTurns.length - 1;

    updatedTurns[lastIndex] = {
      ...updatedTurns[lastIndex],
      agentResponse: {
        ...updatedTurns[lastIndex].agentResponse,
        liveBlocks: liveBlocksFromStore,
        liveToolCalls: liveToolCallsFromStore,
        isStreaming: isStreaming,
      },
    };

    return updatedTurns;
  }, [turns, liveBlocksFromStore, liveToolCallsFromStore, isAgentRunning, isStreaming]);

  // Use virtualization for performance when turn count exceeds threshold
  const shouldVirtualize = turnsWithLiveData.length > 10;

  // Set up virtualizer for turn list
  const virtualizer = useVirtualizer({
    count: turnsWithLiveData.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 150, // Estimated height per turn
    overscan: 5, // Render 5 items above and below viewport
    enabled: shouldVirtualize,
  });

  // SCROLL-TO-TOP DETECTION: Load older turns when user scrolls near the top
  const SCROLL_THRESHOLD = 100; // pixels from top to trigger load

  const handleScroll = useCallback(() => {
    const container = scrollParentRef.current;
    if (!container) return;

    // Near top + has more + not already loading
    if (
      container.scrollTop < SCROLL_THRESHOLD &&
      hasOlderTurns &&
      !isLoadingOlderTurns
    ) {
      // Save scroll height before loading more
      prevScrollHeightRef.current = container.scrollHeight;
      justPrependedRef.current = true;
      fetchOlderTurns();
    }
  }, [hasOlderTurns, isLoadingOlderTurns, fetchOlderTurns]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollParentRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Preserve scroll position when prepending older turns
  useEffect(() => {
    const container = scrollParentRef.current;
    if (!container) return;

    // Detect if turns were prepended (count increased but not at bottom)
    if (justPrependedRef.current && turns.length > prevTurnCountRef.current) {
      // Restore scroll position relative to new content
      const newScrollHeight = container.scrollHeight;
      const scrollDelta = newScrollHeight - prevScrollHeightRef.current;
      container.scrollTop = scrollDelta;
      justPrependedRef.current = false;
    }

    prevTurnCountRef.current = turns.length;
  }, [turns.length]);

  // Subscribe to agent output events when node changes
  // NOTE: Data fetching uses optimistic rendering - cached data shown immediately,
  // background revalidation happens via useViewRouter.navigateToNode
  // OPTIMIZATION: Use ref to track subscription state to avoid duplicate calls in StrictMode
  const hasSubscribedRef = useRef(false);

  useEffect(() => {
    if (!activeRepoId || !activeNodeId) return;

    // Skip if context hasn't actually changed (prevents duplicate runs from dependency changes)
    const lastContext = lastContextRef.current;
    if (lastContext.repoId === activeRepoId && lastContext.nodeId === activeNodeId) {
      return;
    }

    lastContextRef.current = { repoId: activeRepoId, nodeId: activeNodeId };

    // Skip if already subscribed (StrictMode double-invocation guard)
    if (hasSubscribedRef.current) {
      return;
    }
    hasSubscribedRef.current = true;

    // OPTIMIZATION: Defer subscribeToOutput to next frame to not block initial paint
    // This is the most aggressive deferral - let the browser paint first, then subscribe
    const rafId = requestAnimationFrame(() => {
      // Use setTimeout(0) after RAF to ensure we're truly after paint
      setTimeout(() => {
        subscribeToOutput();
      }, 0);
    });

    return () => {
      cancelAnimationFrame(rafId);
      hasSubscribedRef.current = false;
    };
  }, [activeRepoId, activeNodeId, subscribeToOutput]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromOutput();
      lastContextRef.current = { repoId: null, nodeId: null };
    };
  }, [unsubscribeFromOutput]);

  // Restore pending user input when switching to a node with "pending" status
  // This handles the case where user navigates away and back, or reloads the app
  useEffect(() => {
    if (!activeNodeId) return;

    const status = currentNodeStatus?.status;
    if (status === 'pending' && !pendingUserInput) {
      // Try to restore from persisted data
      restorePendingUserInput(activeNodeId);
    }
  }, [activeNodeId, currentNodeStatus?.status, pendingUserInput, restorePendingUserInput]);

  // Listen for agent output events to trigger message refresh (event-driven, not polling)
  // This listener is set up once and uses refs for current context (avoids re-subscribing)
  const activeContextRef = useRef<{ repoId: string | null; nodeId: string | null }>({ repoId: null, nodeId: null });

  // Keep ref updated with current values (for use in listener callbacks)
  useEffect(() => {
    activeContextRef.current = { repoId: activeRepoId, nodeId: activeNodeId };
  }, [activeRepoId, activeNodeId]);

  // Set up agent:output listener ONCE on mount, use ref for current context
  // With the turn-based architecture, we don't need to refetch on every output
  // since live data is streamed directly to the UI via agentStore
  // We only refresh turns when the agent completes (see agent:complete listener)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let lastFetchTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const MIN_FETCH_INTERVAL = 2000; // Increased interval since live data handles streaming

    const setupListener = async () => {
      unlisten = await listen<{ node_id: string }>('agent:output', (event) => {
        const ctx = activeContextRef.current;
        // Only refresh if it's for the current node and enough time has passed
        // This is a fallback for persisted messages - live streaming handles real-time updates
        if (ctx.nodeId && ctx.repoId && event.payload.node_id === ctx.nodeId) {
          const now = Date.now();
          if (now - lastFetchTime >= MIN_FETCH_INTERVAL) {
            lastFetchTime = now;
            const { fetchTurns } = useChatStore.getState();
            fetchTurns(ctx.repoId, ctx.nodeId);
          }
        }
      });
    };

    // OPTIMIZATION: Defer listener setup to not block initial paint
    timeoutId = setTimeout(setupListener, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unlisten) unlisten();
    };
  }, []); // Empty deps - set up once on mount

  // Listen for agent completion to refresh the latest turn and trigger notification
  // Set up ONCE on mount, use ref for current context
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const setupListener = async () => {
      unlisten = await listen<AgentCompleteEvent>('agent:complete', async (event) => {
        const ctx = activeContextRef.current;
        // Only process if it's for the current node
        if (!ctx.nodeId || !ctx.repoId || event.payload.node_id !== ctx.nodeId) return;

        const { refreshLatestTurn } = useChatStore.getState();

        // Refresh only the latest turn's agent messages (not all messages)
        await refreshLatestTurn();

        // Get the latest turn after refresh to extract context
        const latestTurn = useChatStore.getState().turns[useChatStore.getState().turns.length - 1];

        // Find the latest agent message and extract context
        // Note: Backend also extracts context for notifications, but we do it here
        // to update the local node state immediately for the active node
        if (latestTurn && latestTurn.agentResponse.messages.length > 0) {
          const latestAgentMessage = latestTurn.agentResponse.messages[latestTurn.agentResponse.messages.length - 1];

          const matches = [...latestAgentMessage.content.matchAll(CONTEXT_REGEX)];
          const extractedContext = matches.length > 0 ? matches[matches.length - 1][1].trim() : null;

          if (extractedContext) {
            await updateNodeContext(ctx.nodeId, extractedContext);
          }
        }

        // Note: Notification is emitted by agentStore.ts with backend-provided context

        // Clear the completed_pending_context flag by refreshing from backend
        await refreshNodeStatus(ctx.nodeId);

        // Clear live streaming data after a short delay for UI stability
        setTimeout(() => {
          clearLiveDataForNode(ctx.nodeId!);
        }, 500);
      });
    };

    // OPTIMIZATION: Defer listener setup to not block initial paint
    timeoutId = setTimeout(setupListener, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unlisten) unlisten();
    };
  }, [updateNodeContext, refreshNodeStatus, clearLiveDataForNode]); // Only re-run if these store functions change

  // Auto-scroll to bottom only when new turns arrive (not on content updates)
  useEffect(() => {
    if (turns.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = turns.length;
  }, [turns.length]);

  // Tauri file drop event listeners - set up ONCE on mount
  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleDrop = async (filePaths: string[]) => {
      if (!filePaths || filePaths.length === 0) return;

      const { attachments: processed, errors } = await processFilePathsToAttachments(filePaths);

      // Add successfully processed attachments using fresh store reference
      const { addAttachment } = useUIStore.getState();
      for (const attachment of processed) {
        addAttachment(attachment);
      }

      // Show errors if any
      if (errors.length > 0) {
        alert(errors.join('\n'));
      }
    };

    const setupDropListeners = async () => {
      const currentWindow = getCurrentWindow();

      // Listen for all drag-drop events
      const unlistenFn = await currentWindow.onDragDropEvent((event) => {
        // Guard against stale callbacks after unmount
        if (!isMounted) return;

        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'leave') {
          setIsDragging(false);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          handleDrop(event.payload.paths);
        }
      });

      // Check if component unmounted while we were setting up
      if (isMounted) {
        unlisten = unlistenFn;
      } else {
        // Component unmounted during async setup - clean up immediately
        unlistenFn();
      }
    };

    // OPTIMIZATION: Defer listener setup to not block initial paint
    timeoutId = setTimeout(setupDropListeners, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      isMounted = false;
      unlisten?.();
    };
  }, []); // No dependencies - handler uses fresh store state via getState()

  const handleSendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    // Use canSendMessage() to get fresh state - avoids stale closure bugs
    // This reads from store.getState() at execution time, not from closure-captured values
    const checkResult = canSendMessage();
    if (!checkResult.canSend) {
      return;
    }

    // TypeScript knows node exists when canSend is true
    const { node, nodeId } = checkResult;

    // Build message content with attachments
    let messageContent = content;
    if (attachments && attachments.length > 0) {
      const fileList = attachments.map((a) => a.name).join(', ');
      messageContent = `${content}\n\n[Attached files: ${fileList}]`;
    }

    // Prepare attachment metadata for backend
    const attachmentData = attachments?.map(a => ({
      name: a.name,
      type: a.type,
      size: a.size,
      content: a.content, // Base64 encoded content
    }));

    // Send to chat for display with attachment metadata
    await sendMessage(messageContent, 'text', attachmentData ? { attachments: attachmentData } : undefined);

    // Read current UI state directly from store to avoid race conditions
    // (useCallback closures capture stale values if user toggles mode and immediately sends)
    const currentSelectedModel = useUIStore.getState().selectedModel;
    const currentAgentMode = useUIStore.getState().agentMode;

    // Map UI model ID to Claude CLI model name
    const modelMap: Record<string, string> = {
      'opus-4.5': 'opus',
      'sonnet-4.5': 'sonnet',
      'haiku': 'haiku',
    };
    const cliModel = modelMap[currentSelectedModel] || 'sonnet'; // Default to sonnet

    // Spawn agent for the message - session continuity is handled via --resume flag
    // Each spawn checks for existing session ID and resumes the conversation
    // Use the node's worktree_path so agent operates in the correct directory
    // NOTE: We only use worktree_path, never repo.path - the agent must operate in the worktree
    if (!isAgentRunning && activeRepoId && node.worktree_path) {
      const agentSession = await spawnAgent(
          activeRepoId,
          nodeId,  // Use fresh nodeId from canSendMessage
          'claude_code',
          content, // Send original content without file list
          node.worktree_path,  // Always use worktree_path, never fallback to repo.path
          undefined,
          attachmentData, // Pass attachments to agent
          cliModel, // Pass selected model
          currentAgentMode // Pass agent mode (normal, plan, auto)
        );

      // Show error notification if agent failed to spawn
      if (!agentSession) {
        const errorState = useAgentStore.getState().error;
        const errorMessage = errorState || 'Failed to start Claude agent. Please check your configuration.';

        // Show error in UI store for visible display
        useUIStore.getState().setErrorMessage(
          `Agent Error: ${errorMessage}\n\nPress Cmd+Shift+D to run diagnostics and see what's wrong.`
        );

        console.error('Agent spawn failed:', errorMessage);
      }
    }
  }, [canSendMessage, sendMessage, isAgentRunning, activeRepoId, spawnAgent]);

  // Handle user selection from multi-choice questions
  const handleUserInputSelect = useCallback(async (selection: UserInputSelection) => {
    // Require worktree_path - never fall back to repo.path
    if (!activeNodeId || !activeRepoId || !activeNode?.node.worktree_path) return;

    // Format display message based on selection type
    let displayMessage: string;

    if (Array.isArray(selection.selectedIndex)) {
      // Multi-select: format as comma-separated list
      const labels = Array.isArray(selection.selectedLabel)
        ? selection.selectedLabel
        : [selection.selectedLabel];

      if (labels.length === 1) {
        displayMessage = labels[0];
      } else if (labels.length === 2) {
        displayMessage = `${labels[0]} and ${labels[1]}`;
      } else {
        const lastLabel = labels[labels.length - 1];
        const otherLabels = labels.slice(0, -1).join(', ');
        displayMessage = `${otherLabels}, and ${lastLabel}`;
      }
    } else {
      // Single-select (existing behavior)
      displayMessage = selection.selectedLabel === 'Other' && selection.selectedDescription
        ? String(selection.selectedDescription)
        : String(selection.selectedLabel);
    }

    await sendMessage(displayMessage, 'text');

    // Then submit selection to resume agent
    // IMPORTANT: Use worktree_path to ensure Claude CLI can find the session
    // Sessions are stored by project/cwd - must match the spawn working directory
    await submitUserSelection(
      activeNodeId,
      activeRepoId,
      activeNode.node.worktree_path,  // Always use worktree_path, never repo.path
      selection
    );
  }, [activeNodeId, activeRepoId, activeNode, sendMessage, submitUserSelection]);

  // Handle dismiss of user input
  const handleUserInputDismiss = useCallback(() => {
    if (!activeNodeId) return;
    dismissUserInput(activeNodeId);
  }, [activeNodeId, dismissUserInput]);

  // Only show chat when a workspace is selected - use glass-main-content for consistent background
  if (!activeRepoId) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary glass-main-content">
        <div className="text-center">
          <p className="text-text-secondary">Select a workspace to start</p>
        </div>
      </div>
    );
  }

  // No node selected - use glass-main-content for consistent background (prevents flash)
  if (!activeNode) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary glass-main-content">
        <div className="text-center">
          <p className="text-display mb-2 text-text-secondary">No active node</p>
          <p className="text-body text-text-tertiary">Select a node from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass-main-content chat-text relative">
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-bg-stage/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-interactive bg-surface-secondary/50">
            <svg
              className="w-12 h-12 text-interactive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-display font-medium text-text-primary">Drop files to attach</p>
              <p className="text-body text-text-tertiary mt-1">Images, code, documents, and more</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area - centered with max width for readability */}
      <div className="flex-1 overflow-y-auto" ref={scrollParentRef}>
        <div className="max-w-[820px] xl:max-w-[1000px] 2xl:max-w-[1200px] 3xl:max-w-[1600px] mx-auto px-4 pt-3.5 pb-4">
        {(isLoading || isNodeLoading || (activeNodeId && !activeNode)) && turns.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{isNodeLoading || (activeNodeId && !activeNode) ? 'Loading node...' : 'Loading...'}</span>
            </div>
          </div>
        )}

        {!isLoading && !isNodeLoading && activeNode && turns.length === 0 && (
          <div className="space-y-3">
            {/* Context header */}
            <div className="bg-surface-secondary rounded-lg px-4 py-3">
              <p className="text-text-primary text-body font-medium">
                Working on {activeNode.node.display_name}
              </p>
            </div>

            {/* Context info with icons */}
            <div className="space-y-2 text-body">
              {/* Branch info */}
              <div className="flex items-center gap-2 text-text-secondary">
                <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Node <span className="text-text-primary font-medium">{activeNode.node.display_name}</span></span>
              </div>

              {/* Workspace info */}
              {activeRepo && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Workspace <span className="text-text-primary font-medium">{activeRepo.name}</span></span>
                </div>
              )}

              {/* Worktree/Ready state */}
              <div className="flex items-center gap-2 text-text-secondary">
                {activeNode.node.worktree_status === 'creating' ? (
                  <>
                    <svg className="w-4 h-4 text-text-tertiary animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Preparing worktree...</span>
                  </>
                ) : activeNode.node.worktree_status === 'ready' ? (
                  <>
                    <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Ready to assist</span>
                  </>
                ) : activeNode.node.worktree_status === 'failed' ? (
                  <>
                    <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-error">Worktree setup failed</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Waiting for worktree...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-3 text-error text-body mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Loading indicator for older turns */}
          {isLoadingOlderTurns && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-text-tertiary text-sm">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading older messages...</span>
              </div>
            </div>
          )}

          {shouldVirtualize ? (
            // Virtualized rendering for >10 turns
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const turnIndex = virtualItem.index;
                const turn = turnsWithLiveData[turnIndex];
                const isLastTurn = turnIndex === turnsWithLiveData.length - 1;
                const hasAgentMessages = turn.agentResponse.messages.length > 0;
                const hasLiveData = turn.agentResponse.liveBlocks.length > 0 || turn.agentResponse.liveToolCalls.length > 0;

                return (
                  <div
                    key={turn.id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {/* Render user message - ALWAYS visible (never windowed) */}
                    <MessageBubble
                      message={turn.userMessage}
                      showHeader={true}
                      isGrouped={false}
                      isFirstInGroup={false}
                      isLastInGroup={false}
                    />

                    {/* Render agent response with structured formatting */}
                    {(hasAgentMessages || hasLiveData || (isLastTurn && isAgentRunning)) && (
                      <AgentTurnRenderer
                        messages={turn.agentResponse.messages}
                        isAgentRunning={isLastTurn && isAgentRunning}
                        isStreaming={turn.agentResponse.isStreaming}
                        liveToolCalls={turn.agentResponse.liveToolCalls}
                        liveBlocks={turn.agentResponse.liveBlocks}
                        isLiveData={isLastTurn && isAgentRunning && turn.agentResponse.isStreaming}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Non-virtualized rendering for ≤10 turns
            <>
              {turnsWithLiveData.map((turn, turnIndex) => {
                const isLastTurn = turnIndex === turnsWithLiveData.length - 1;
                const hasAgentMessages = turn.agentResponse.messages.length > 0;
                const hasLiveData = turn.agentResponse.liveBlocks.length > 0 || turn.agentResponse.liveToolCalls.length > 0;

                return (
                  <div key={turn.id}>
                    {/* Render user message - ALWAYS visible (never windowed) */}
                    <MessageBubble
                      message={turn.userMessage}
                      showHeader={true}
                      isGrouped={false}
                      isFirstInGroup={false}
                      isLastInGroup={false}
                    />

                    {/* Render agent response with structured formatting */}
                    {(hasAgentMessages || hasLiveData || (isLastTurn && isAgentRunning)) && (
                      <AgentTurnRenderer
                        messages={turn.agentResponse.messages}
                        isAgentRunning={isLastTurn && isAgentRunning}
                        isStreaming={turn.agentResponse.isStreaming}
                        liveToolCalls={turn.agentResponse.liveToolCalls}
                        liveBlocks={turn.agentResponse.liveBlocks}
                        isLiveData={isLastTurn && isAgentRunning && turn.agentResponse.isStreaming}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* User input block - show when agent is waiting for user selection */}
          {/* Hide when isSubmitted to prevent re-render flicker from race conditions */}
          {pendingUserInput && !pendingUserInput.isSubmitted && (
            <div className="py-2">
              <UserInputBlock
                toolId={pendingUserInput.request.tool_id}
                question={pendingUserInput.request.question}
                header={pendingUserInput.request.header}
                options={pendingUserInput.request.options}
                multiSelect={pendingUserInput.request.multi_select}
                onSelect={handleUserInputSelect}
                onDismiss={handleUserInputDismiss}
                isSubmitting={pendingUserInput.isSubmitting}
                isSubmitted={pendingUserInput.isSubmitted}
                submittedSelection={pendingUserInput.submittedSelection}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        </div>
      </div>

      {/* Composer - compact footer with faint gradient separation */}
      <div className="relative">
        {/* Faint gradient fade from content to composer */}
        <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-black/[0.15] to-transparent pointer-events-none" />
        <div className="max-w-[820px] xl:max-w-[1000px] 2xl:max-w-[1200px] 3xl:max-w-[1600px] mx-auto px-4 py-2.5">
          <EnhancedChatInput
            onSend={handleSendMessage}
            disabled={isNodeLoading || !activeNode || activeNode?.node.worktree_status !== 'ready'}
            placeholder={
              isNodeLoading || (activeNodeId && !activeNode) ? 'Loading node...'
              : activeNode?.node.worktree_status === 'creating' ? 'Worktree is being prepared...'
              : activeNode?.node.worktree_status === 'failed' ? 'Worktree setup failed. Retry from sidebar.'
              : activeNode?.node.worktree_status !== 'ready' ? 'Waiting for worktree...'
              : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
