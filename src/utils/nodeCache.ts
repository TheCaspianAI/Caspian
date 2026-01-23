/**
 * nodeCache.ts - TTL-based cache for node data with stale-while-revalidate support
 *
 * Provides instant access to cached node data while ensuring freshness through
 * background revalidation. Supports parallel loading of related data.
 */

import type { NodeWithManifest, Message, AuditEntry, ConversationTurn } from '../types';

// Cache entry with timestamp for TTL checks
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/**
 * Default cache configuration (exported for reference and customization)
 */
export const DEFAULT_CACHE_CONFIG = {
  // How long cached data is considered "fresh" (no revalidation needed)
  NODE_FRESH_TTL: 60_000,      // 60 seconds (increased from 30s for better cache hit rate)
  MESSAGES_FRESH_TTL: 60_000,  // 60 seconds (increased from 30s for better cache hit rate)
  TURNS_FRESH_TTL: 60_000,     // 60 seconds for turn-based cache
  AUDIT_FRESH_TTL: 120_000,    // 2 minutes (audit log changes less often)

  // How long cached data can be used while revalidating (stale-while-revalidate window)
  NODE_STALE_TTL: 600_000,     // 10 minutes (increased from 5 minutes)
  MESSAGES_STALE_TTL: 300_000, // 5 minutes (increased from 1 minute)
  TURNS_STALE_TTL: 300_000,    // 5 minutes for turn-based cache
  AUDIT_STALE_TTL: 600_000,    // 10 minutes (increased from 5 minutes)

  // Maximum cache size (LRU eviction when exceeded)
  MAX_NODES: 50,
  MAX_MESSAGE_SETS: 20,
  MAX_TURN_SETS: 20,           // Maximum turn sets to cache
} as const;

// Mutable cache configuration - starts with defaults
let cacheConfig = { ...DEFAULT_CACHE_CONFIG };

/**
 * Configure cache TTLs at runtime
 * @param overrides - Partial configuration to merge with defaults
 */
export function configureCacheTTLs(overrides: Partial<typeof DEFAULT_CACHE_CONFIG>): void {
  cacheConfig = { ...cacheConfig, ...overrides };
}

/**
 * Get current cache configuration
 */
export function getCacheConfig(): typeof DEFAULT_CACHE_CONFIG {
  return { ...cacheConfig };
}

// Separate caches for different data types
const nodeCache = new Map<string, CacheEntry<NodeWithManifest>>();
const messagesCache = new Map<string, CacheEntry<Message[]>>();
const turnsCache = new Map<string, CacheEntry<ConversationTurn[]>>();
const auditCache = new Map<string, CacheEntry<AuditEntry[]>>();

// Track access order for LRU eviction
const nodeAccessOrder: string[] = [];
const messagesAccessOrder: string[] = [];
const turnsAccessOrder: string[] = [];

/**
 * Update LRU access order - move item to end (most recently used)
 */
function updateAccessOrder(order: string[], key: string, maxSize: number): void {
  const index = order.indexOf(key);
  if (index > -1) {
    order.splice(index, 1);
  }
  order.push(key);

  // Evict oldest if over limit
  while (order.length > maxSize) {
    const evictKey = order.shift();
    if (evictKey) {
      nodeCache.delete(evictKey);
      messagesCache.delete(evictKey);
    }
  }
}

// ============================================================================
// NODE CACHE
// ============================================================================

export interface NodeCacheResult {
  data: NodeWithManifest | null;
  status: 'fresh' | 'stale' | 'miss';
}

/**
 * Get node from cache with freshness status
 */
export function getNodeFromCache(nodeId: string): NodeCacheResult {
  const entry = nodeCache.get(nodeId);

  if (!entry) {
    return { data: null, status: 'miss' };
  }

  const age = Date.now() - entry.fetchedAt;
  updateAccessOrder(nodeAccessOrder, nodeId, cacheConfig.MAX_NODES);

  if (age < cacheConfig.NODE_FRESH_TTL) {
    return { data: entry.data, status: 'fresh' };
  }

  if (age < cacheConfig.NODE_STALE_TTL) {
    return { data: entry.data, status: 'stale' };
  }

  // Too old, treat as miss
  nodeCache.delete(nodeId);
  return { data: null, status: 'miss' };
}

/**
 * Store node in cache
 */
export function setNodeInCache(nodeId: string, data: NodeWithManifest): void {
  nodeCache.set(nodeId, { data, fetchedAt: Date.now() });
  updateAccessOrder(nodeAccessOrder, nodeId, cacheConfig.MAX_NODES);
}

/**
 * Invalidate a specific node (call after updates)
 */
export function invalidateNode(nodeId: string): void {
  nodeCache.delete(nodeId);
}

/**
 * Update node in cache without changing fetchedAt (for local updates)
 */
export function updateNodeInCache(nodeId: string, updater: (node: NodeWithManifest) => NodeWithManifest): void {
  const entry = nodeCache.get(nodeId);
  if (entry) {
    nodeCache.set(nodeId, { data: updater(entry.data), fetchedAt: entry.fetchedAt });
  }
}

// ============================================================================
// MESSAGES CACHE
// ============================================================================

export interface MessagesCacheResult {
  data: Message[] | null;
  status: 'fresh' | 'stale' | 'miss';
}

/**
 * Get messages from cache with freshness status
 */
export function getMessagesFromCache(nodeId: string): MessagesCacheResult {
  const entry = messagesCache.get(nodeId);

  if (!entry) {
    return { data: null, status: 'miss' };
  }

  const age = Date.now() - entry.fetchedAt;
  updateAccessOrder(messagesAccessOrder, nodeId, cacheConfig.MAX_MESSAGE_SETS);

  if (age < cacheConfig.MESSAGES_FRESH_TTL) {
    return { data: entry.data, status: 'fresh' };
  }

  if (age < cacheConfig.MESSAGES_STALE_TTL) {
    return { data: entry.data, status: 'stale' };
  }

  // Too old, treat as miss
  messagesCache.delete(nodeId);
  return { data: null, status: 'miss' };
}

/**
 * Store messages in cache
 */
export function setMessagesInCache(nodeId: string, data: Message[]): void {
  messagesCache.set(nodeId, { data, fetchedAt: Date.now() });
  updateAccessOrder(messagesAccessOrder, nodeId, cacheConfig.MAX_MESSAGE_SETS);
}

/**
 * Append a message to cached messages (for optimistic updates)
 */
export function appendMessageToCache(nodeId: string, message: Message): void {
  const entry = messagesCache.get(nodeId);
  if (entry) {
    // Deduplicate by ID
    const existing = entry.data.find(m => m.id === message.id);
    if (!existing) {
      entry.data.push(message);
    }
  }
}

/**
 * Invalidate messages cache for a node
 */
export function invalidateMessages(nodeId: string): void {
  messagesCache.delete(nodeId);
}

// ============================================================================
// AUDIT CACHE
// ============================================================================

export interface AuditCacheResult {
  data: AuditEntry[] | null;
  status: 'fresh' | 'stale' | 'miss';
}

/**
 * Get audit log from cache
 */
export function getAuditFromCache(nodeId: string): AuditCacheResult {
  const entry = auditCache.get(nodeId);

  if (!entry) {
    return { data: null, status: 'miss' };
  }

  const age = Date.now() - entry.fetchedAt;

  if (age < cacheConfig.AUDIT_FRESH_TTL) {
    return { data: entry.data, status: 'fresh' };
  }

  if (age < cacheConfig.AUDIT_STALE_TTL) {
    return { data: entry.data, status: 'stale' };
  }

  auditCache.delete(nodeId);
  return { data: null, status: 'miss' };
}

/**
 * Store audit log in cache
 */
export function setAuditInCache(nodeId: string, data: AuditEntry[]): void {
  auditCache.set(nodeId, { data, fetchedAt: Date.now() });
}

// ============================================================================
// TURNS CACHE (NEW - for separated message streams)
// ============================================================================

export interface TurnsCacheResult {
  data: ConversationTurn[] | null;
  status: 'fresh' | 'stale' | 'miss';
}

/**
 * Update turns access order for LRU eviction
 */
function updateTurnsAccessOrder(key: string): void {
  const index = turnsAccessOrder.indexOf(key);
  if (index > -1) {
    turnsAccessOrder.splice(index, 1);
  }
  turnsAccessOrder.push(key);

  // Evict oldest if over limit
  while (turnsAccessOrder.length > cacheConfig.MAX_TURN_SETS) {
    const evictKey = turnsAccessOrder.shift();
    if (evictKey) {
      turnsCache.delete(evictKey);
    }
  }
}

/**
 * Get turns from cache with freshness status
 */
export function getTurnsFromCache(nodeId: string): TurnsCacheResult {
  const entry = turnsCache.get(nodeId);

  if (!entry) {
    return { data: null, status: 'miss' };
  }

  const age = Date.now() - entry.fetchedAt;
  updateTurnsAccessOrder(nodeId);

  if (age < cacheConfig.TURNS_FRESH_TTL) {
    return { data: entry.data, status: 'fresh' };
  }

  if (age < cacheConfig.TURNS_STALE_TTL) {
    return { data: entry.data, status: 'stale' };
  }

  // Too old, treat as miss
  turnsCache.delete(nodeId);
  return { data: null, status: 'miss' };
}

/**
 * Store turns in cache
 */
export function setTurnsInCache(nodeId: string, data: ConversationTurn[]): void {
  turnsCache.set(nodeId, { data, fetchedAt: Date.now() });
  updateTurnsAccessOrder(nodeId);
}

/**
 * Append a turn to cached turns (for optimistic updates when user sends message)
 */
export function appendTurnToCache(nodeId: string, turn: ConversationTurn): void {
  const entry = turnsCache.get(nodeId);
  if (entry) {
    // Deduplicate by turn ID
    const existing = entry.data.find(t => t.id === turn.id);
    if (!existing) {
      entry.data.push(turn);
      // Refresh timestamp to keep cache fresh
      entry.fetchedAt = Date.now();
    }
  }
}

/**
 * Update a turn's agent messages in cache (after agent completes)
 */
export function updateTurnAgentMessages(
  nodeId: string,
  turnId: string,
  agentMessages: Message[]
): void {
  const entry = turnsCache.get(nodeId);
  if (entry) {
    const turn = entry.data.find(t => t.id === turnId);
    if (turn) {
      turn.agentResponse.messages = agentMessages;
      turn.agentResponse.isComplete = true;
      turn.agentResponse.isStreaming = false;
      // Refresh timestamp
      entry.fetchedAt = Date.now();
    }
  }
}

/**
 * Invalidate turns cache for a node
 */
export function invalidateTurns(nodeId: string): void {
  turnsCache.delete(nodeId);
  const index = turnsAccessOrder.indexOf(nodeId);
  if (index > -1) {
    turnsAccessOrder.splice(index, 1);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all caches (useful for logout or major state changes)
 */
export function clearAllCaches(): void {
  nodeCache.clear();
  messagesCache.clear();
  turnsCache.clear();
  auditCache.clear();
  nodeAccessOrder.length = 0;
  messagesAccessOrder.length = 0;
  turnsAccessOrder.length = 0;
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): {
  nodes: number;
  messages: number;
  turns: number;
  audit: number;
} {
  return {
    nodes: nodeCache.size,
    messages: messagesCache.size,
    turns: turnsCache.size,
    audit: auditCache.size,
  };
}

/**
 * Prefetch a node into cache (for hover prefetching)
 * Returns a promise that resolves when the fetch is complete
 */
export async function prefetchNode(
  nodeId: string,
  fetcher: () => Promise<NodeWithManifest | null>
): Promise<void> {
  const cached = getNodeFromCache(nodeId);
  if (cached.status === 'fresh') {
    return; // Already fresh, no need to prefetch
  }

  const data = await fetcher();
  if (data) {
    setNodeInCache(nodeId, data);
  }
}
