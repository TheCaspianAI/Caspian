import { useNavigate, useParams } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";

type CloseContext = {
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
};

/**
 * Mutation hook for closing a node without deleting the worktree
 * Uses optimistic updates to immediately remove node from UI,
 * then performs actual close in background.
 * Automatically navigates away if the closed node is currently being viewed.
 */
export function useCloseNode(
	options?: Parameters<typeof electronTrpc.nodes.close.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();
	const navigate = useNavigate();
	const params = useParams({ strict: false });

	return electronTrpc.nodes.close.useMutation({
		...options,
		onMutate: async ({ id }) => {
			// Cancel outgoing refetches to avoid overwriting optimistic update
			await Promise.all([
				utils.nodes.getAll.cancel(),
				utils.nodes.getAllGrouped.cancel(),
			]);

			// Snapshot previous values for rollback
			const previousGrouped = utils.nodes.getAllGrouped.getData();
			const previousAll = utils.nodes.getAll.getData();

			// Optimistically remove node from getAllGrouped cache
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

			// Optimistically remove node from getAll cache
			if (previousAll) {
				utils.nodes.getAll.setData(
					undefined,
					previousAll.filter((n) => n.id !== id),
				);
			}

			// Return context for rollback
			return { previousGrouped, previousAll } as CloseContext;
		},
		onError: (_err, _variables, context) => {
			// Rollback to previous state on error
			if (context?.previousGrouped !== undefined) {
				utils.nodes.getAllGrouped.setData(
					undefined,
					context.previousGrouped,
				);
			}
			if (context?.previousAll !== undefined) {
				utils.nodes.getAll.setData(undefined, context.previousAll);
			}
		},
		onSuccess: async (data, variables, ...rest) => {
			// Invalidate to ensure consistency with backend state
			await utils.nodes.invalidate();
			// Invalidate repository queries since close updates repository metadata
			await utils.repositories.getRecents.invalidate();

			// If the closed node is currently being viewed, navigate away
			if (params.nodeId === variables.id) {
				// Try to navigate to previous node first, then next
				const prevNodeId =
					await utils.nodes.getPreviousNode.fetch({
						id: variables.id,
					});
				const nextNodeId = await utils.nodes.getNextNode.fetch({
					id: variables.id,
				});

				const targetNodeId = prevNodeId ?? nextNodeId;

				if (targetNodeId) {
					navigateToNode(targetNodeId, navigate);
				} else {
					// No other nodes, navigate to workspace index (shows StartView)
					navigate({ to: "/workspace" });
				}
			}

			// Call user's onSuccess if provided
			await options?.onSuccess?.(data, variables, ...rest);
		},
	});
}
