import { z } from "zod";
import type {
	BulkItemError,
	CommandResult,
	ToolContext,
	ToolDefinition,
} from "./types";
import { buildBulkResult } from "./types";

const nodeInputSchema = z.object({
	name: z.string().optional(),
	branchName: z.string().optional(),
	baseBranch: z.string().optional(),
});

const schema = z.object({
	nodes: z.array(nodeInputSchema).min(1).max(5),
});

interface CreatedNode {
	nodeId: string;
	nodeName: string;
	branch: string;
}

async function execute(
	params: z.infer<typeof schema>,
	ctx: ToolContext,
): Promise<CommandResult> {
	// Derive repositoryId from current node or use the only available repository
	const nodes = ctx.getNodes();
	if (!nodes || nodes.length === 0) {
		return { success: false, error: "No nodes available" };
	}

	// Try to get from current node first
	let repositoryId: string | null = null;
	const activeNodeId = ctx.getActiveNodeId();
	if (activeNodeId) {
		const activeNode = nodes.find(
			(n) => n.id === activeNodeId,
		);
		if (activeNode) {
			repositoryId = activeNode.repositoryId;
		}
	}

	// Fall back to the most recently used node's repository
	if (!repositoryId) {
		const sorted = [...nodes].sort(
			(a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0),
		);
		repositoryId = sorted[0].repositoryId;
	}

	const created: CreatedNode[] = [];
	const errors: BulkItemError[] = [];

	for (const [i, input] of params.nodes.entries()) {
		try {
			const result = await ctx.createWorktree.mutateAsync({
				repositoryId,
				name: input.name,
				branchName: input.branchName,
				baseBranch: input.baseBranch,
			});

			created.push({
				nodeId: result.node.id,
				nodeName: result.node.name,
				branch: result.node.branch,
			});
		} catch (error) {
			errors.push({
				index: i,
				name: input.name,
				branchName: input.branchName,
				error:
					error instanceof Error ? error.message : "Failed to create node",
			});
		}
	}

	return buildBulkResult({
		items: created,
		errors,
		itemKey: "created",
		allFailedMessage: "All node creations failed",
		total: params.nodes.length,
	});
}

export const createNode: ToolDefinition<typeof schema> = {
	name: "create_node",
	schema,
	execute,
};
