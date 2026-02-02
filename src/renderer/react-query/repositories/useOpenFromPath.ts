import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Mutation hook for opening a repository from a given path
 * Used when dragging folders into the sidebar
 */
export function useOpenFromPath(
	options?: Parameters<
		typeof electronTrpc.repositories.openFromPath.useMutation
	>[0],
) {
	const utils = electronTrpc.useUtils();

	return electronTrpc.repositories.openFromPath.useMutation({
		...options,
		onSuccess: async (...args) => {
			// Auto-invalidate repositories query
			await utils.repositories.getRecents.invalidate();

			// Call user's onSuccess if provided
			await options?.onSuccess?.(...args);
		},
	});
}
