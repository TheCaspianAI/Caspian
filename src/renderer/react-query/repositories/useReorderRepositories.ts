import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for reordering repositories
 * Automatically invalidates node and repository queries on success
 */
export function useReorderRepositories(
	options?: Parameters<typeof electronTrpc.repositories.reorder.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.repositories.reorder.useMutation({
		...options,
		onSuccess: async (...args) => {
			await utils.nodes.getAllGrouped.invalidate();
			await utils.repositories.getRecents.invalidate();
			await options?.onSuccess?.(...args);
		},
	});
}
