import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for opening a new repository
 * Creates a Repository record if it doesn't exist
 */
export function useOpenNew(
	options?: Parameters<typeof electronTrpc.repositories.openNew.useMutation>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.repositories.openNew.useMutation({
		...options,
		onSuccess: async (...args) => {
			// Auto-invalidate repositories query
			await utils.repositories.getRecents.invalidate();

			// Call user's onSuccess if provided
			await options?.onSuccess?.(...args);
		},
	});
}
