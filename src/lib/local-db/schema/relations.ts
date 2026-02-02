import { relations } from "drizzle-orm";
import { nodes, repositories, worktrees } from "./schema";

export const repositoriesRelations = relations(repositories, ({ many }) => ({
	worktrees: many(worktrees),
	nodes: many(nodes),
}));

export const worktreesRelations = relations(worktrees, ({ one, many }) => ({
	repository: one(repositories, {
		fields: [worktrees.repositoryId],
		references: [repositories.id],
	}),
	nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one }) => ({
	repository: one(repositories, {
		fields: [nodes.repositoryId],
		references: [repositories.id],
	}),
	worktree: one(worktrees, {
		fields: [nodes.worktreeId],
		references: [worktrees.id],
	}),
}));
