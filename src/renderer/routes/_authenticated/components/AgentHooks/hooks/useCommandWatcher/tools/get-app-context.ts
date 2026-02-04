import { z } from "zod";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";

const schema = z.object({});

async function execute(_params: z.infer<typeof schema>, ctx: ToolContext): Promise<CommandResult> {
	// Hash routing: path is in window.location.hash (e.g., "#/workspace/abc123")
	const hash = window.location.hash;
	const pathname = hash.startsWith("#") ? hash.slice(1) : hash;

	// Parse node ID from route if present (route is /workspace/$workspaceId)
	const nodeMatch = pathname.match(/\/workspace\/([^/]+)/);
	const currentNodeId = nodeMatch ? nodeMatch[1] : null;

	// Get node details if we have an ID
	let currentNode = null;
	if (currentNodeId) {
		const nodes = ctx.getNodes();
		currentNode = nodes?.find((n) => n.id === currentNodeId) ?? null;
	}

	return {
		success: true,
		data: {
			pathname,
			currentNodeId,
			currentNode,
		},
	};
}

export const getAppContext: ToolDefinition<typeof schema> = {
	name: "get_app_context",
	schema,
	execute,
};
