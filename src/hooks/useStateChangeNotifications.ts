import { useEffect, useRef } from 'react';
import { safeListen, safeInvoke } from '../utils/tauri';
import { useWindowFocusStore } from '../stores/windowFocusStore';
import { useToastStore } from '../stores/toastStore';
import { useNodeStore } from '../stores/nodeStore';

interface NodeStateChangeEvent {
  node_id: string;
  node_name: string;
  previous_state: string;
  new_state: string;
  timestamp: string;
}

// Deduplication: track recent notifications to prevent duplicates
// Key format: "nodeId:newState", value: timestamp
const recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 2000; // Ignore duplicate events within 2 seconds

// Clean old entries periodically
const cleanupRecentNotifications = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS * 2) {
      recentNotifications.delete(key);
    }
  }
};

const STATE_TITLES: Record<string, string> = {
  // Node state transitions
  ready_for_review: 'Ready for Review',
  approved: 'Node Approved',
  closed: 'Node Closed',
  in_progress: 'Back to In Progress',
  // Execution status transitions (no agent_running - user doesn't want "started" notifications)
  idle: 'Agent Completed',
  needs_input: 'Input Required',
};

const formatStateName = (state: string): string => {
  // Handle execution statuses
  if (state === 'agent_running') return 'running';
  if (state === 'idle') return 'completed';
  if (state === 'needs_input') return 'awaiting input';
  return state.replace(/_/g, ' ');
};

// Execution statuses that should notify (idle = completed, needs_input)
// Note: agent_running is excluded - user doesn't want "started" notifications
const NOTIFY_EXECUTION_STATUSES = ['idle', 'needs_input'];

// Play notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    // Audio not supported or blocked
  }
};

export function useStateChangeNotifications() {
  const addToast = useToastStore((s) => s.addToast);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      // Prevent duplicate subscriptions using ref (persists across renders)
      if (isSubscribedRef.current) return;
      isSubscribedRef.current = true;

      unlisten = await safeListen<NodeStateChangeEvent>('node:state-change', async (event) => {
        const { node_id, node_name, new_state } = event;
        const { isFocused } = useWindowFocusStore.getState();
        const nodeState = useNodeStore.getState().activeNodeState;
        const activeNodeId = nodeState.status !== 'none' ? nodeState.nodeId : null;

        // Skip agent_running (started) - user only wants completed/needs_input
        if (new_state === 'agent_running') {
          return;
        }

        // Deduplication check: skip if we recently showed this notification
        const dedupKey = `${node_id}:${new_state}`;
        const now = Date.now();
        const lastNotified = recentNotifications.get(dedupKey);
        if (lastNotified && now - lastNotified < DEDUP_WINDOW_MS) {
          return; // Skip duplicate
        }
        recentNotifications.set(dedupKey, now);
        cleanupRecentNotifications(); // Clean old entries

        // For non-execution state changes, skip if viewing the active node
        const isExecutionStatus = NOTIFY_EXECUTION_STATUSES.includes(new_state);
        if (!isExecutionStatus && node_id === activeNodeId) {
          return;
        }

        const title = STATE_TITLES[new_state] || 'State Changed';
        const message = `"${node_name}" is now ${formatStateName(new_state)}`;

        if (isFocused) {
          // Play sound and show in-app toast
          playNotificationSound();
          addToast({
            type: 'state-change',
            title,
            message,
            nodeId: node_id,
            duration: 6000,
          });
        } else {
          // Send system notification via backend (system handles sound)
          await safeInvoke('send_system_notification', { title, body: message });
        }
      });
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
        isSubscribedRef.current = false;
      }
    };
  }, [addToast]);
}
