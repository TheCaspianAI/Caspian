import { z } from "zod";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";

const schema = z
	.object({
		nodeId: z.string().optional(),
		nodeName: z.string().optional(),
	})
	.refine((data) => data.nodeId || data.nodeName, {
		message: "Must provide nodeId or nodeName",
	});

async function execute(
	params: z.infer<typeof schema>,
	ctx: ToolContext,
): Promise<CommandResult> {
	let targetNodeId = params.nodeId;

	// Look up by name if no ID provided
	if (!targetNodeId && params.nodeName) {
		const nodes = ctx.getNodes();
		if (!nodes) {
			return { success: false, error: "Failed to get nodes" };
		}

		const searchName = params.nodeName.toLowerCase();
		const found = nodes.find(
			(n) =>
				n.name.toLowerCase() === searchName ||
				n.branch.toLowerCase() === searchName,
		);

		if (!found) {
			return {
				success: false,
				error: `Node "${params.nodeName}" not found`,
			};
		}
		targetNodeId = found.id;
	}

	if (!targetNodeId) {
		return {
			success: false,
			error: "Could not determine node to navigate to",
		};
	}

	try {
		await ctx.navigateToNode(targetNodeId);
		return {
			success: true,
			data: { nodeId: targetNodeId },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to navigate",
		};
	}
}

export const navigateToNode: ToolDefinition<typeof schema> = {
	name: "navigate_to_node",
	schema,
	execute,
};
