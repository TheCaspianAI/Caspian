import type { SelectNode, SelectRepository } from "lib/local-db";
import type { electronTrpc } from "renderer/lib/electron-trpc";
import type { z } from "zod";

export interface CommandResult {
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
}

export interface BulkItemError {
	index: number;
	error: string;
	[key: string]: unknown;
}

export function buildBulkResult<T>({
	items,
	errors,
	itemKey,
	allFailedMessage,
	total,
}: {
	items: T[];
	errors: BulkItemError[];
	itemKey: string;
	allFailedMessage: string;
	total: number;
}): CommandResult {
	const data: Record<string, unknown> = {
		[itemKey]: items,
		summary: { total, succeeded: items.length, failed: errors.length },
	};
	if (errors.length > 0) data.errors = errors;
	return {
		success: items.length > 0,
		data,
		error: items.length === 0 ? allFailedMessage : undefined,
	};
}

// Available mutations and queries passed to tool handlers
export interface ToolContext {
	// Mutations
	createWorktree: ReturnType<typeof electronTrpc.nodes.create.useMutation>;
	setActive: ReturnType<typeof electronTrpc.nodes.setActive.useMutation>;
	deleteNode: ReturnType<typeof electronTrpc.nodes.delete.useMutation>;
	updateNode: ReturnType<typeof electronTrpc.nodes.update.useMutation>;
	// Query helpers
	refetchNodes: () => Promise<unknown>;
	getNodes: () => SelectNode[] | undefined;
	getRepositories: () => SelectRepository[] | undefined;
	getActiveNodeId: () => string | null;
	// Navigation
	navigateToNode: (nodeId: string) => Promise<void>;
}

// Tool definition with schema and execute function
export interface ToolDefinition<T extends z.ZodType> {
	name: string;
	schema: T;
	execute: (params: z.infer<T>, ctx: ToolContext) => Promise<CommandResult>;
}
