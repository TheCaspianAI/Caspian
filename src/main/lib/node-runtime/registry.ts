/**
 * Node Runtime Registry
 *
 * Process-scoped registry for node runtime providers.
 * The registry is cached for the lifetime of the process.
 *
 * Current behavior:
 * - All nodes use the LocalNodeRuntime
 * - The runtime is selected once based on settings (requires restart to change)
 *
 * Future behavior (cloud readiness):
 * - Per-node selection based on node metadata (cloudNodeId, etc.)
 * - Local + cloud nodes can coexist
 */

import { LocalNodeRuntime } from "./local";
import type { NodeRuntime, NodeRuntimeRegistry } from "./types";

// =============================================================================
// Registry Implementation
// =============================================================================

/**
 * Default registry implementation.
 *
 * Currently returns the same LocalNodeRuntime for all nodes.
 * The interface supports per-node selection for future cloud work.
 */
class DefaultNodeRuntimeRegistry implements NodeRuntimeRegistry {
	private localRuntime: LocalNodeRuntime | null = null;

	/**
	 * Get the runtime for a specific node.
	 *
	 * Currently always returns the local runtime.
	 * Future: will check node metadata to select local vs cloud.
	 */
	getForNodeId(_nodeId: string): NodeRuntime {
		// Currently all nodes use the local runtime
		// Future: check node metadata for cloudNodeId to select cloud runtime
		return this.getDefault();
	}

	/**
	 * Get the default runtime (for global/legacy endpoints).
	 *
	 * Returns the local runtime, lazily initialized.
	 * The runtime instance is cached for the lifetime of the process.
	 */
	getDefault(): NodeRuntime {
		if (!this.localRuntime) {
			this.localRuntime = new LocalNodeRuntime();
		}
		return this.localRuntime;
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

let registryInstance: NodeRuntimeRegistry | null = null;

/**
 * Get the node runtime registry.
 *
 * The registry is process-scoped and cached. Callers should capture it once
 * (e.g., when creating a tRPC router) and use it for the lifetime of the router.
 *
 * This design allows:
 * 1. Stable runtime instances (no re-creation on each call)
 * 2. Consistent event wiring (same backend for all listeners)
 * 3. Future per-node selection (local vs cloud)
 */
export function getNodeRuntimeRegistry(): NodeRuntimeRegistry {
	if (!registryInstance) {
		registryInstance = new DefaultNodeRuntimeRegistry();
	}
	return registryInstance;
}

/**
 * Reset the registry (for testing only).
 * This should not be called in production code.
 */
export function resetNodeRuntimeRegistry(): void {
	registryInstance = null;
}
