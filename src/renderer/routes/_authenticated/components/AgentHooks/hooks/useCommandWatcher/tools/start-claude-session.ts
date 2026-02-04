import { useNodeInitStore } from "renderer/stores/node-init";
import { z } from "zod";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";

const schema = z.object({
	command: z.string(),
	name: z.string(),
});

async function execute(params: z.infer<typeof schema>, ctx: ToolContext): Promise<CommandResult> {
	// 1. Derive repositoryId from current node or most recent
	const nodes = ctx.getNodes();
	if (!nodes || nodes.length === 0) {
		return { success: false, error: "No nodes available" };
	}

	let repositoryId: string | null = null;
	const activeNodeId = ctx.getActiveNodeId();
	if (activeNodeId) {
		const activeNode = nodes.find((n) => n.id === activeNodeId);
		if (activeNode) {
			repositoryId = activeNode.repositoryId;
		}
	}

	if (!repositoryId) {
		const sorted = [...nodes].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
		repositoryId = sorted[0].repositoryId;
	}

	try {
		// 2. Create node
		const result = await ctx.createWorktree.mutateAsync({
			repositoryId,
			name: params.name,
			branchName: params.name,
		});

		// 3. Append command to pending terminal setup
		const store = useNodeInitStore.getState();
		const pending = store.pendingTerminalSetups[result.node.id];
		store.addPendingTerminalSetup({
			nodeId: result.node.id,
			repositoryId: pending?.repositoryId ?? repositoryId,
			initialCommands: [...(pending?.initialCommands ?? []), params.command],
			defaultPreset: pending?.defaultPreset ?? null,
		});

		return {
			success: true,
			data: {
				nodeId: result.node.id,
				branch: result.node.branch,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to start Claude session",
		};
	}
}

export const startClaudeSession: ToolDefinition<typeof schema> = {
	name: "start_claude_session",
	schema,
	execute,
};
