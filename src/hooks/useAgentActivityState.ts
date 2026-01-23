import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../stores/agentStore';

// Timing constants for state transitions
const TIMING = {
  THINKING_DELAY_MS: 500,       // Before showing thinking indicator
  THINKING_MIN_DISPLAY_MS: 300, // Minimum indicator display time
  STREAMING_GAP_MS: 500,        // Gap before transitioning to thinking
  INITIALIZING_TIMEOUT_MS: 200, // Time before initializing -> thinking
};

export type AgentActivityState =
  | 'idle'
  | 'initializing'
  | 'thinking'
  | 'streaming'
  | 'completing';

export interface ActivityStateContext {
  state: AgentActivityState;
  lastOutputTime: number | null;
  elapsedSinceLastOutput: number;
  totalElapsedTime: number;
  outputCount: number;
}

export interface UseAgentActivityStateReturn {
  activityState: AgentActivityState;
  isThinking: boolean;
  isStreaming: boolean;
  elapsedTime: number;
  elapsedSinceLastOutput: number;
}

/**
 * Hook to track agent activity state based on output timing
 * Provides reactive state for UI indicators
 */
export function useAgentActivityState(nodeId: string | null): UseAgentActivityStateReturn {
  const [state, setState] = useState<AgentActivityState>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [elapsedSinceLastOutput, setElapsedSinceLastOutput] = useState(0);

  // Refs for timing tracking
  const startTimeRef = useRef<number | null>(null);
  const lastOutputTimeRef = useRef<number | null>(null);
  const outputCountRef = useRef(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use interval instead of RAF for elapsed time (1s updates vs 60fps)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get agent store state
  const nodeStatus = useAgentStore((s) => nodeId ? s.nodeStatus[nodeId] : null);
  const outputBuffer = useAgentStore((s) => nodeId ? s.outputBuffer[nodeId] : undefined);

  // Check if agent is running for this node
  const isAgentRunning = nodeStatus?.status === 'running';

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (minDisplayTimerRef.current) {
      clearTimeout(minDisplayTimerRef.current);
      minDisplayTimerRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    clearTimers();
    setState('idle');
    setElapsedTime(0);
    setElapsedSinceLastOutput(0);
    startTimeRef.current = null;
    lastOutputTimeRef.current = null;
    outputCountRef.current = 0;
  }, [clearTimers]);

  // Schedule transition to thinking state
  const scheduleThinkingTransition = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
    }

    thinkingTimerRef.current = setTimeout(() => {
      setState((currentState) => {
        // Only transition to thinking from streaming or initializing
        if (currentState === 'streaming' || currentState === 'initializing') {
          return 'thinking';
        }
        return currentState;
      });
    }, TIMING.STREAMING_GAP_MS);
  }, []);

  // Handle agent start
  useEffect(() => {
    if (isAgentRunning && state === 'idle') {
      // Agent just started
      startTimeRef.current = Date.now();
      setState('initializing');
      outputCountRef.current = 0;

      // Update elapsed time once per second (not 60fps via RAF)
      // This drastically reduces re-renders while still providing useful feedback
      elapsedIntervalRef.current = setInterval(() => {
        const now = Date.now();
        if (startTimeRef.current) {
          setElapsedTime(now - startTimeRef.current);
        }
        if (lastOutputTimeRef.current) {
          setElapsedSinceLastOutput(now - lastOutputTimeRef.current);
        }
      }, 1000);

      // Schedule transition to thinking if no output received
      thinkingTimerRef.current = setTimeout(() => {
        setState('thinking');
      }, TIMING.INITIALIZING_TIMEOUT_MS);
    } else if (!isAgentRunning && state !== 'idle') {
      // Agent stopped - transition to completing then idle
      setState('completing');

      // Clear timers but keep elapsed time visible briefly
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }

      // Reset after completion animation
      setTimeout(() => {
        resetState();
      }, 1000);
    }
  }, [isAgentRunning, state, resetState]);

  // Handle new output
  useEffect(() => {
    if (!outputBuffer || !isAgentRunning) return;

    const currentCount = outputBuffer.length;

    // New output received
    if (currentCount > outputCountRef.current) {
      outputCountRef.current = currentCount;
      lastOutputTimeRef.current = Date.now();

      // Transition to streaming
      setState('streaming');

      // Clear any pending thinking timer
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }

      // Schedule next thinking transition
      scheduleThinkingTransition();
    }
  }, [outputBuffer, isAgentRunning, scheduleThinkingTransition]);

  // Cleanup on unmount or node change
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [nodeId, clearTimers]);

  // Reset when node changes
  useEffect(() => {
    resetState();
  }, [nodeId, resetState]);

  return {
    activityState: state,
    isThinking: state === 'thinking' || state === 'initializing',
    isStreaming: state === 'streaming',
    elapsedTime,
    elapsedSinceLastOutput,
  };
}
