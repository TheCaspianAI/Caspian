import { z } from "zod";
import type { BulkItemError, CommandResult, ToolContext, ToolDefinition } from "./types";
import { buildBulkResult } from "./types";

const nodeUpdateSchema = z.object({
	nodeId: z.string().uuid(),
	name: z.string().min(1),
});

const schema = z.object({
	updates: z.array(nodeUpdateSchema).min(1).max(5),
});

interface UpdatedNode {
	nodeId: string;
	name: string;
}

async function execute(params: z.infer<typeof schema>, ctx: ToolContext): Promise<CommandResult> {
	const updated: UpdatedNode[] = [];
	const errors: BulkItemError[] = [];

	for (const [i, update] of params.updates.entries()) {
		try {
			await ctx.updateNode.mutateAsync({
				id: update.nodeId,
				patch: { name: update.name },
			});

			updated.push({
				nodeId: update.nodeId,
				name: update.name,
			});
		} catch (error) {
			errors.push({
				index: i,
				nodeId: update.nodeId,
				error: error instanceof Error ? error.message : "Failed to update node",
			});
		}
	}

	return buildBulkResult({
		items: updated,
		errors,
		itemKey: "updated",
		allFailedMessage: "All node updates failed",
		total: params.updates.length,
	});
}

export const updateNode: ToolDefinition<typeof schema> = {
	name: "update_node",
	schema,
	execute,
};
