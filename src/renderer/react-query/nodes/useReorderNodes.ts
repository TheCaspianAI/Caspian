import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for reordering nodes
 * Automatically invalidates node queries on success
 */
export function useReorderNodes(
	options?: Parameters<typeof electronTrpc.nodes.reorder.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.nodes.reorder.useMutation({
		...options,
		onSuccess: async (...args) => {
			await utils.nodes.getAll.invalidate();
			await utils.nodes.getAllGrouped.invalidate();
			await options?.onSuccess?.(...args);
		},
	});
}
