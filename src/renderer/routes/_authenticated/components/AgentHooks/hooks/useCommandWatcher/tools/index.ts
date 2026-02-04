import { createNode } from "./create-worktree";
import { deleteNode } from "./delete-node";
import { getAppContext } from "./get-app-context";
import { listNodes } from "./list-nodes";
import { listRepositories } from "./list-projects";
import { navigateToNode } from "./navigate-to-node";
import { startClaudeSession } from "./start-claude-session";
import { startClaudeSubagent } from "./start-claude-subagent";
import { switchNode } from "./switch-node";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";
import { updateNode } from "./update-node";

// Registry of all available tools
// biome-ignore lint/suspicious/noExplicitAny: Tool schemas vary
const tools: ToolDefinition<any>[] = [
	createNode,
	deleteNode,
	getAppContext,
	listRepositories,
	listNodes,
	navigateToNode,
	startClaudeSession,
	startClaudeSubagent,
	switchNode,
	updateNode,
];

// Map for O(1) lookup by name
const toolsByName = new Map(tools.map((t) => [t.name, t]));

/**
 * Execute a tool by name with validation.
 * Returns error if tool not found or params invalid.
 */
export async function executeTool(
	name: string,
	params: Record<string, unknown> | null,
	ctx: ToolContext,
): Promise<CommandResult> {
	const tool = toolsByName.get(name);

	if (!tool) {
		return { success: false, error: `Unknown tool: ${name}` };
	}

	// Validate params
	const parsed = tool.schema.safeParse(params ?? {});
	if (!parsed.success) {
		return {
			success: false,
			error: `Invalid params: ${parsed.error.errors.map((e: { message: string }) => e.message).join(", ")}`,
		};
	}

	return tool.execute(parsed.data, ctx);
}

export type { CommandResult, ToolContext } from "./types";
