import { z } from "zod";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";

const schema = z.object({});

async function execute(_params: z.infer<typeof schema>, ctx: ToolContext): Promise<CommandResult> {
	const nodes = ctx.getNodes();

	if (!nodes) {
		return { success: false, error: "Failed to get nodes" };
	}

	return {
		success: true,
		data: { nodes: nodes as unknown as Record<string, unknown>[] },
	};
}

export const listNodes: ToolDefinition<typeof schema> = {
	name: "list_nodes",
	schema,
	execute,
};
