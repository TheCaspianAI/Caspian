import { useEffect, useState, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { useAgentStore } from '../stores/agentStore';
import type {
  Node,
  BranchStats,
  NodeCardData,
  CommandResult,
  PrInfo,
  AgentSession,
} from '../types';

interface UseNodeCardDataOptions {
  /** Refresh interval in milliseconds. Set to 0 to disable auto-refresh */
  refreshInterval?: number;
}

/**
 * Hook to fetch and aggregate all data needed for a NodeCard display
 */
export function useNodeCardData(
  node: Node | undefined,
  options: UseNodeCardDataOptions = {}
): NodeCardData | null {
  // Increased from 10s to 30s to reduce backend polling overhead
  const { refreshInterval = 30000 } = options;

  const [stats, setStats] = useState<BranchStats | null>(null);
  const [prInfo, setPrInfo] = useState<PrInfo | null>(null);

  const nodeStatus = useAgentStore((state) => node ? state.nodeStatus[node.id] : null);
  const liveToolCalls = useAgentStore((state) => node ? state.liveToolCalls[node.id] : []);

  // Fetch branch stats
  const fetchStats = useCallback(async () => {
    if (!node?.id) return;

    try {
      const result = await safeInvoke<CommandResult<BranchStats>>('get_branch_stats', {
        nodeId: node.id,
      });
      if (result?.success && result?.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch branch stats:', err);
    }
  }, [node?.id]);

  // Fetch PR info
  const fetchPrInfo = useCallback(async () => {
    if (!node?.id) return;

    try {
      const result = await safeInvoke<CommandResult<PrInfo>>('get_pr_info', {
        nodeId: node.id,
      });
      if (result?.success && result?.data) {
        setPrInfo(result.data);
      }
    } catch (err) {
      // PR info is optional, don't log errors
    }
  }, [node?.id]);

  // Initial fetch and refresh
  useEffect(() => {
    if (!node?.id) return;

    fetchStats();
    fetchPrInfo();

    // Set up periodic refresh if interval > 0
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchStats();
        fetchPrInfo();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [node?.id, refreshInterval, fetchStats, fetchPrInfo]);

  // Build card data
  if (!node) return null;

  // Get current tool from live tool calls
  const runningToolCall = liveToolCalls?.find(tc => tc.status === 'running');
  const currentTool = runningToolCall?.name || null;
  const currentToolInput = runningToolCall?.input
    ? formatToolInput(runningToolCall.name, runningToolCall.input)
    : null;

  // Count errors from completed tool calls
  const errorCount = liveToolCalls?.filter(tc => tc.isError).length || 0;

  // Extract model from agent session or default
  const model = extractModel(nodeStatus);

  return {
    id: node.id,
    context: node.context,
    goal: node.goal,
    displayName: node.display_name,
    internalBranch: node.internal_branch,
    parentBranch: node.parent_branch,
    originalParentBranch: node.original_parent_branch,
    state: node.state,
    worktreeStatus: node.worktree_status,
    stats,
    todoProgress: null, // TODO: Extract from agent output when available
    errorCount,
    agentStatus: nodeStatus,
    currentTool,
    currentToolInput,
    model,
    prInfo,
    messageCount: 0, // Would need backend support to get count per node
    lastActivity: node.last_active_at,
  };
}

/**
 * Hook to fetch NodeCardData for multiple nodes efficiently (batched)
 */
export function useNodeCardDataBatch(
  nodes: Node[],
  options: UseNodeCardDataOptions = {}
): Map<string, NodeCardData> {
  // Increased from 10s to 30s to reduce backend polling overhead
  const { refreshInterval = 30000 } = options;

  const [statsMap, setStatsMap] = useState<Map<string, BranchStats>>(new Map());
  const [prInfoMap] = useState<Map<string, PrInfo>>(new Map());

  const nodeStatus = useAgentStore((state) => state.nodeStatus);
  const liveToolCalls = useAgentStore((state) => state.liveToolCalls);

  // Batch fetch stats for all nodes
  const fetchAllStats = useCallback(async () => {
    if (nodes.length === 0) return;

    const newStatsMap = new Map<string, BranchStats>();

    // Fetch stats in parallel (batched)
    await Promise.all(
      nodes.map(async (node) => {
        try {
          const result = await safeInvoke<CommandResult<BranchStats>>('get_branch_stats', {
            nodeId: node.id,
          });
          if (result?.success && result?.data) {
            newStatsMap.set(node.id, result.data);
          }
        } catch {
          // Ignore individual failures
        }
      })
    );

    setStatsMap(newStatsMap);
  }, [nodes]);

  // Initial fetch and refresh
  useEffect(() => {
    if (nodes.length === 0) return;

    fetchAllStats();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAllStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [nodes.length, refreshInterval, fetchAllStats]);

  // Build card data map
  const cardDataMap = new Map<string, NodeCardData>();

  for (const node of nodes) {
    const nodeLiveToolCalls = liveToolCalls[node.id] || [];
    const runningToolCall = nodeLiveToolCalls.find(tc => tc.status === 'running');
    const currentTool = runningToolCall?.name || null;
    const currentToolInput = runningToolCall?.input
      ? formatToolInput(runningToolCall.name, runningToolCall.input)
      : null;
    const errorCount = nodeLiveToolCalls.filter(tc => tc.isError).length;
    const session = nodeStatus[node.id] || null;

    cardDataMap.set(node.id, {
      id: node.id,
      context: node.context,
      goal: node.goal,
      displayName: node.display_name,
      internalBranch: node.internal_branch,
      parentBranch: node.parent_branch,
      originalParentBranch: node.original_parent_branch,
      state: node.state,
      worktreeStatus: node.worktree_status,
      stats: statsMap.get(node.id) || null,
      todoProgress: null,
      errorCount,
      agentStatus: session,
      currentTool,
      currentToolInput,
      model: extractModel(session),
      prInfo: prInfoMap.get(node.id) || null,
      messageCount: 0,
      lastActivity: node.last_active_at,
    });
  }

  return cardDataMap;
}

/**
 * Format tool input for display
 */
function formatToolInput(_toolName: string, input: Record<string, unknown>): string {
  // For file operations, show the file path
  if (input.file_path) {
    return String(input.file_path);
  }
  if (input.path) {
    return String(input.path);
  }
  // For Bash, show the command (truncated)
  if (input.command) {
    const cmd = String(input.command);
    return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd;
  }
  // For grep/glob, show the pattern
  if (input.pattern) {
    return String(input.pattern);
  }
  // For Task, show the description
  if (input.description) {
    return String(input.description);
  }
  // Default: show first string value
  const firstValue = Object.values(input).find(v => typeof v === 'string');
  if (firstValue) {
    const val = String(firstValue);
    return val.length > 50 ? val.slice(0, 47) + '...' : val;
  }
  return '';
}

/**
 * Extract model name from agent session
 */
function extractModel(session: AgentSession | null | undefined): string | null {
  // The model info might be stored in session metadata or we derive from adapter type
  // For now, return a default based on adapter type
  if (!session) return null;

  // If adapter is claude_code, we know it's Claude
  if (session.adapter_type === 'claude_code') {
    return 'Claude'; // Could be more specific if we track the model
  }
  return null;
}
