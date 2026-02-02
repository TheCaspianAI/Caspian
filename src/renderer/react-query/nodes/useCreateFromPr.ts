import { useNavigate } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useNodeInitStore } from "renderer/stores/node-init";
import type { NodeInitProgress } from "shared/types/node-init";

type MutationOptions = Parameters<
	typeof electronTrpc.nodes.createFromPr.useMutation
>[0];

export function useCreateFromPr(options?: MutationOptions) {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const addPendingTerminalSetup = useNodeInitStore(
		(s) => s.addPendingTerminalSetup,
	);
	const updateProgress = useNodeInitStore((s) => s.updateProgress);

	return electronTrpc.nodes.createFromPr.useMutation({
		...options,
		onSuccess: async (data, ...rest) => {
			// Set optimistic progress before navigation for new nodes
			if (!data.wasExisting && data.initialCommands) {
				const optimisticProgress: NodeInitProgress = {
					nodeId: data.node.id,
					repositoryId: data.repositoryId,
					step: "pending",
					message: "Preparing...",
				};
				updateProgress(optimisticProgress);
			}

			// Setup terminal if there are initial commands
			if (data.initialCommands) {
				addPendingTerminalSetup({
					nodeId: data.node.id,
					repositoryId: data.repositoryId,
					initialCommands: data.initialCommands,
				});
			}

			await utils.nodes.invalidate();

			// Navigate to the node
			navigateToNode(data.node.id, navigate);

			await options?.onSuccess?.(data, ...rest);
		},
	});
}
