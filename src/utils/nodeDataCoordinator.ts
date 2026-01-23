/**
 * nodeDataCoordinator.ts - Parallel data loading for node navigation
 *
 * Coordinates loading all node-related data in parallel to minimize
 * total loading time when navigating to a node. Handles:
 * - Node data fetching with caching
 * - Message loading with lazy pagination
 * - Agent status refresh
 * - Prefetch on hover for predictive loading
 */

import { useNodeStore } from '../stores/nodeStore';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';
import { getNodeFromCache, getTurnsFromCache } from './nodeCache';

export interface ParallelLoadOptions {
  nodeId: string;
  repoId: string;
  /** Skip loading messages (e.g., if already have fresh cache) */
  skipMessages?: boolean;
  /** Skip loading agent status */
  skipAgentStatus?: boolean;
}

export interface ParallelLoadResult {
  nodeLoaded: boolean;
  messagesLoaded: boolean;
  agentStatusLoaded: boolean;
  errors: string[];
}

/**
 * Load all node-related data in parallel
 *
 * This function coordinates parallel fetching of:
 * - Node data (with manifest)
 * - Chat messages (with lazy loading)
 * - Agent status
 * - Audit log
 *
 * Uses cache when available to provide instant results.
 */
export async function loadNodeDataParallel(
  options: ParallelLoadOptions
): Promise<ParallelLoadResult> {
  const { nodeId, repoId, skipMessages = false, skipAgentStatus = false } = options;

  const result: ParallelLoadResult = {
    nodeLoaded: false,
    messagesLoaded: false,
    agentStatusLoaded: false,
    errors: [],
  };

  const nodeStore = useNodeStore.getState();
  const chatStore = useChatStore.getState();
  const agentStore = useAgentStore.getState();

  // Check node cache (messages cache is checked internally by setContext)
  const cachedNode = getNodeFromCache(nodeId);

  // Build array of promises to run in parallel
  const promises: Promise<void>[] = [];

  // 1. Node data - only fetch if not fresh in cache
  if (cachedNode.status !== 'fresh') {
    promises.push(
      (async () => {
        await nodeStore.fetchNode(nodeId);
        result.nodeLoaded = true;
      })().catch((err) => {
        result.errors.push(`Node: ${err}`);
      })
    );
  } else {
    result.nodeLoaded = true;
  }

  // 2. Messages - setContext handles caching and fetching internally
  // It checks cache, shows cached data immediately, and revalidates if stale
  if (!skipMessages) {
    promises.push(
      (async () => {
        await chatStore.setContext(repoId, nodeId);
        result.messagesLoaded = true;
      })().catch((err) => {
        result.errors.push(`Messages: ${err}`);
      })
    );
  } else {
    result.messagesLoaded = true;
  }

  // 3. Agent status
  if (!skipAgentStatus) {
    promises.push(
      (async () => {
        await agentStore.getAgentStatus(nodeId);
        result.agentStatusLoaded = true;
      })().catch((err) => {
        result.errors.push(`AgentStatus: ${err}`);
      })
    );
  } else {
    result.agentStatusLoaded = true;
  }

  // 4. Audit log (fire-and-forget, not tracked in result)
  nodeStore.fetchAuditLog(nodeId);

  // Wait for all promises to complete
  await Promise.allSettled(promises);

  return result;
}

/**
 * Prefetch node data AND turns on hover (with debouncing handled by caller)
 *
 * Warms both node and turn caches for instant navigation.
 * All fetches run in parallel for best performance.
 */
export async function prefetchNodeOnHover(nodeId: string, repoId?: string): Promise<void> {
  const nodeCache = getNodeFromCache(nodeId);
  const turnsCache = getTurnsFromCache(nodeId);

  const promises: Promise<void>[] = [];

  // Prefetch node data if not cached
  if (nodeCache.status === 'miss') {
    const nodeStore = useNodeStore.getState();
    promises.push(nodeStore.fetchNode(nodeId));
  }

  // Prefetch turns if not cached and we have repoId
  if (turnsCache.status === 'miss' && repoId) {
    const chatStore = useChatStore.getState();
    promises.push(
      chatStore.fetchTurns(repoId, nodeId).then(() => {}) // Convert to void
    );
  }

  // Run in parallel
  await Promise.all(promises);
}

/**
 * Prefetch turns for a node (for predictive loading)
 */
export async function prefetchTurns(
  nodeId: string,
  repoId: string
): Promise<void> {
  const cached = getTurnsFromCache(nodeId);

  if (cached.status === 'miss') {
    const chatStore = useChatStore.getState();
    await chatStore.fetchTurns(repoId, nodeId);
  }
}
