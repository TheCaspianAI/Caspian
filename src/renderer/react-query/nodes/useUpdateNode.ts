import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for updating a node
 * Automatically invalidates all node queries on success
 */
export function useUpdateNode(
	options?: Parameters<typeof electronTrpc.nodes.update.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.nodes.update.useMutation({
		...options,
		onSuccess: async (...args) => {
			// Auto-invalidate all node queries
			await utils.nodes.invalidate();

			// Call user's onSuccess if provided
			await options?.onSuccess?.(...args);
		},
	});
}
