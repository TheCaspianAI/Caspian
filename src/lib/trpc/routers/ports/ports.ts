import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { nodes } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { hasStaticPortsConfig, loadStaticPorts, staticPortsWatcher } from "main/lib/static-ports";
import { portManager } from "main/lib/terminal/port-manager";
import type { DetectedPort, StaticPort } from "shared/types";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { getNodePath } from "../nodes/utils/worktree";

type PortEvent = { type: "add"; port: DetectedPort } | { type: "remove"; port: DetectedPort };

export const createPortsRouter = () => {
	return router({
		getAll: publicProcedure.query(() => {
			return portManager.getAllPorts();
		}),

		subscribe: publicProcedure.subscription(() => {
			return observable<PortEvent>((emit) => {
				const onAdd = (port: DetectedPort) => {
					emit.next({ type: "add", port });
				};

				const onRemove = (port: DetectedPort) => {
					emit.next({ type: "remove", port });
				};

				portManager.on("port:add", onAdd);
				portManager.on("port:remove", onRemove);

				return () => {
					portManager.off("port:add", onAdd);
					portManager.off("port:remove", onRemove);
				};
			});
		}),

		kill: publicProcedure
			.input(
				z.object({
					paneId: z.string(),
					port: z.number().int().positive(),
				}),
			)
			.mutation(async ({ input }): Promise<{ success: boolean; error?: string }> => {
				return portManager.killPort(input);
			}),

		hasStaticConfig: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.query(({ input }): { hasStatic: boolean } => {
				const node = localDb.select().from(nodes).where(eq(nodes.id, input.nodeId)).get();

				if (!node) {
					return { hasStatic: false };
				}

				const nodePath = getNodePath(node);
				if (!nodePath) {
					return { hasStatic: false };
				}

				return { hasStatic: hasStaticPortsConfig(nodePath) };
			}),

		getStatic: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.query(({ input }): { ports: StaticPort[] | null; error: string | null } => {
				const node = localDb.select().from(nodes).where(eq(nodes.id, input.nodeId)).get();

				if (!node) {
					return { ports: null, error: "Node not found" };
				}

				const nodePath = getNodePath(node);
				if (!nodePath) {
					return { ports: null, error: "Node path not found" };
				}

				const result = loadStaticPorts(nodePath);

				if (!result.exists) {
					return { ports: null, error: null };
				}

				if (result.error) {
					return { ports: null, error: result.error };
				}

				const portsWithNode: StaticPort[] =
					result.ports?.map((p) => ({
						...p,
						nodeId: input.nodeId,
					})) ?? [];

				return { ports: portsWithNode, error: null };
			}),

		getAllStatic: publicProcedure.query(
			(): {
				ports: StaticPort[];
				errors: Array<{ nodeId: string; error: string }>;
			} => {
				const allNodes = localDb.select().from(nodes).all();
				const allPorts: StaticPort[] = [];
				const errors: Array<{ nodeId: string; error: string }> = [];

				for (const node of allNodes) {
					const nodePath = getNodePath(node);
					if (!nodePath) continue;

					const result = loadStaticPorts(nodePath);

					if (!result.exists) continue;

					if (result.error) {
						errors.push({ nodeId: node.id, error: result.error });
						continue;
					}

					if (result.ports) {
						const portsWithNode = result.ports.map((p) => ({
							...p,
							nodeId: node.id,
						}));
						allPorts.push(...portsWithNode);
					}
				}

				return { ports: allPorts, errors };
			},
		),

		subscribeStatic: publicProcedure
			.input(z.object({ nodeId: z.string() }))
			.subscription(({ input }) => {
				return observable<{ type: "change" }>((emit) => {
					const node = localDb.select().from(nodes).where(eq(nodes.id, input.nodeId)).get();

					if (!node) {
						return () => {};
					}

					const nodePath = getNodePath(node);
					if (!nodePath) {
						return () => {};
					}

					staticPortsWatcher.watch(input.nodeId, nodePath);

					const onChange = (changedNodeId: string) => {
						if (changedNodeId === input.nodeId) {
							emit.next({ type: "change" });
						}
					};

					staticPortsWatcher.on("change", onChange);

					return () => {
						staticPortsWatcher.off("change", onChange);
						staticPortsWatcher.unwatch(input.nodeId);
					};
				});
			}),
	});
};
