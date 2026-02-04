/**
 * Node Runtime Module
 *
 * This module provides the node-scoped runtime abstraction.
 * Use getNodeRuntimeRegistry() to get the registry and select
 * the appropriate runtime for a node.
 *
 * Example usage:
 * ```typescript
 * const registry = getNodeRuntimeRegistry();
 * const runtime = registry.getForNodeId(nodeId);
 * const result = await runtime.terminal.createOrAttach(params);
 * ```
 */

export { LocalNodeRuntime } from "./local";
export {
	getNodeRuntimeRegistry,
	resetNodeRuntimeRegistry,
} from "./registry";
export type {
	NodeRuntime,
	NodeRuntimeId,
	NodeRuntimeRegistry,
	TerminalCapabilities,
	TerminalEventSource,
	TerminalManagement,
	TerminalRuntime,
	TerminalSessionOperations,
	TerminalWorkspaceOperations,
} from "./types";
