import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for updating a repository (name, color, etc.)
 * Automatically invalidates repository + node queries on success
 */
export function useUpdateRepository(
	options?: Parameters<typeof electronTrpc.repositories.update.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.repositories.update.useMutation({
		...options,
		onSuccess: async (...args) => {
			await Promise.all([
				utils.repositories.getRecents.invalidate(),
				utils.nodes.getAllGrouped.invalidate(),
			]);

			await options?.onSuccess?.(...args);
		},
	});
}
