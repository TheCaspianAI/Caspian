import { nodes } from "lib/local-db";
import { and, eq, isNull } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import {
	getNodeNotDeleting,
	setLastActiveNode,
	touchNode,
} from "../utils/db-helpers";

export const createStatusProcedures = () => {
	return router({
		reorder: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					fromIndex: z.number(),
					toIndex: z.number(),
				}),
			)
			.mutation(({ input }) => {
				const { repositoryId, fromIndex, toIndex } = input;

				const repositoryNodes = localDb
					.select()
					.from(nodes)
					.where(
						and(
							eq(nodes.repositoryId, repositoryId),
							isNull(nodes.deletingAt),
						),
					)
					.all()
					.sort((a, b) => a.tabOrder - b.tabOrder);

				if (
					fromIndex < 0 ||
					fromIndex >= repositoryNodes.length ||
					toIndex < 0 ||
					toIndex >= repositoryNodes.length
				) {
					throw new Error("Invalid fromIndex or toIndex");
				}

				const [removed] = repositoryNodes.splice(fromIndex, 1);
				repositoryNodes.splice(toIndex, 0, removed);

				for (let i = 0; i < repositoryNodes.length; i++) {
					localDb
						.update(nodes)
						.set({ tabOrder: i })
						.where(eq(nodes.id, repositoryNodes[i].id))
						.run();
				}

				return { success: true };
			}),

		update: publicProcedure
			.input(
				z.object({
					id: z.string(),
					patch: z.object({
						name: z.string().optional(),
					}),
				}),
			)
			.mutation(({ input }) => {
				const node = getNodeNotDeleting(input.id);
				if (!node) {
					throw new Error(
						`Node ${input.id} not found or is being deleted`,
					);
				}

				touchNode(input.id, {
					...(input.patch.name !== undefined && { name: input.patch.name }),
				});

				return { success: true };
			}),

		setUnread: publicProcedure
			.input(z.object({ id: z.string(), isUnread: z.boolean() }))
			.mutation(({ input }) => {
				const node = getNodeNotDeleting(input.id);
				if (!node) {
					throw new Error(
						`Node ${input.id} not found or is being deleted`,
					);
				}

				localDb
					.update(nodes)
					.set({ isUnread: input.isUnread })
					.where(eq(nodes.id, input.id))
					.run();

				return { success: true, isUnread: input.isUnread };
			}),

		setActive: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.mutation(({ input }) => {
				const node = getNodeNotDeleting(input.nodeId);
				if (!node) {
					throw new Error(
						`Node ${input.nodeId} not found or is being deleted`,
					);
				}

				setLastActiveNode(input.nodeId);

				return { success: true, nodeId: input.nodeId };
			}),
	});
};
