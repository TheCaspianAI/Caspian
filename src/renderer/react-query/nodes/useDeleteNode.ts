import { useNavigate, useParams } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";

type DeleteContext = {
	previousGrouped: ReturnType<
		typeof electronTrpc.useUtils
	>["nodes"]["getAllGrouped"]["getData"] extends () => infer R
		? R
		: never;
	previousAll: ReturnType<
		typeof electronTrpc.useUtils
	>["nodes"]["getAll"]["getData"] extends () => infer R
		? R
		: never;
	wasViewingDeleted: boolean;
	navigatedTo: string | null;
};

/**
 * Mutation hook for deleting a node with optimistic updates.
 * Server marks `deletingAt` immediately so refetches stay correct during slow git operations.
 * Optimistically navigates away immediately if the deleted node is currently being viewed.
 * Navigates back on error to restore the user to the original node.
 */
export function useDeleteNode(
	options?: Parameters<typeof electronTrpc.nodes.delete.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();
	const navigate = useNavigate();
	const params = useParams({ strict: false });

	return electronTrpc.nodes.delete.useMutation({
		...options,
		onMutate: async ({ id }) => {
			// Check if we're viewing the node being deleted
			const wasViewingDeleted = params.nodeId === id;
			let navigatedTo: string | null = null;

			// If viewing deleted node, get navigation target BEFORE optimistic update
			if (wasViewingDeleted) {
				const prevNodeId = await utils.nodes.getPreviousNode.fetch({ id });
				const nextNodeId = await utils.nodes.getNextNode.fetch({
					id,
				});
				const targetNodeId = prevNodeId ?? nextNodeId;

				if (targetNodeId) {
					navigatedTo = targetNodeId;
					navigateToNode(targetNodeId, navigate);
				} else {
					navigatedTo = "/node";
					navigate({ to: "/node" });
				}
			}

			// Cancel outgoing queries and get snapshots
			await Promise.all([utils.nodes.getAll.cancel(), utils.nodes.getAllGrouped.cancel()]);

			const previousGrouped = utils.nodes.getAllGrouped.getData();
			const previousAll = utils.nodes.getAll.getData();

			// Optimistic update: remove node from cache
			if (previousGrouped) {
				utils.nodes.getAllGrouped.setData(
					undefined,
					previousGrouped
						.map((group) => ({
							...group,
							nodes: group.nodes.filter((n) => n.id !== id),
						}))
						.filter((group) => group.nodes.length > 0),
				);
			}

			if (previousAll) {
				utils.nodes.getAll.setData(
					undefined,
					previousAll.filter((n) => n.id !== id),
				);
			}

			return {
				previousGrouped,
				previousAll,
				wasViewingDeleted,
				navigatedTo,
			} as DeleteContext;
		},
		onSettled: async (...args) => {
			await utils.nodes.invalidate();
			await options?.onSettled?.(...args);
		},
		onSuccess: async (data, variables, ...rest) => {
			// Navigation already handled in onMutate (optimistic)
			await options?.onSuccess?.(data, variables, ...rest);
		},
		onError: async (_err, variables, context, ...rest) => {
			// Rollback optimistic cache updates
			if (context?.previousGrouped !== undefined) {
				utils.nodes.getAllGrouped.setData(undefined, context.previousGrouped);
			}
			if (context?.previousAll !== undefined) {
				utils.nodes.getAll.setData(undefined, context.previousAll);
			}

			// If we optimistically navigated away, navigate back to the deleted node
			if (context?.wasViewingDeleted) {
				navigateToNode(variables.id, navigate);
			}

			await options?.onError?.(_err, variables, context, ...rest);
		},
	});
}
