import { z } from "zod";
import type { CommandResult, ToolContext, ToolDefinition } from "./types";

const schema = z.object({});

async function execute(_params: z.infer<typeof schema>, ctx: ToolContext): Promise<CommandResult> {
	const repositories = ctx.getRepositories();

	if (!repositories) {
		return { success: false, error: "Repositories not available" };
	}

	return {
		success: true,
		data: {
			repositories: repositories.map((r) => ({
				id: r.id,
				name: r.name,
				mainRepoPath: r.mainRepoPath,
				defaultBranch: r.defaultBranch,
				color: r.color,
				lastOpenedAt: r.lastOpenedAt,
				tabOrder: r.tabOrder,
			})),
		},
	};
}

export const listRepositories: ToolDefinition<typeof schema> = {
	name: "list_repositories",
	schema,
	execute,
};
