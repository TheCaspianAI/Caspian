import { z } from "zod";
import type {
	BulkItemError,
	CommandResult,
	ToolContext,
	ToolDefinition,
} from "./types";
import { buildBulkResult } from "./types";

const schema = z.object({
	nodeIds: z.array(z.string().uuid()).min(1).max(5),
});

interface DeletedNode {
	nodeId: string;
}

async function execute(
	params: z.infer<typeof schema>,
	ctx: ToolContext,
): Promise<CommandResult> {
	const deleted: DeletedNode[] = [];
	const errors: BulkItemError[] = [];

	for (const [i, nodeId] of params.nodeIds.entries()) {
		try {
			const result = await ctx.deleteNode.mutateAsync({
				id: nodeId,
			});

			if (!result.success) {
				errors.push({
					index: i,
					nodeId,
					error: result.error ?? "Delete failed",
				});
			} else {
				deleted.push({ nodeId });
			}
		} catch (error) {
			errors.push({
				index: i,
				nodeId,
				error:
					error instanceof Error ? error.message : "Failed to delete node",
			});
		}
	}

	return buildBulkResult({
		items: deleted,
		errors,
		itemKey: "deleted",
		allFailedMessage: "All node deletions failed",
		total: params.nodeIds.length,
	});
}

export const deleteNode: ToolDefinition<typeof schema> = {
	name: "delete_node",
	schema,
	execute,
};
