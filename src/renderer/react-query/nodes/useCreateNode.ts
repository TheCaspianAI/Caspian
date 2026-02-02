import { useNavigate } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useNodeInitStore } from "renderer/stores/node-init";
import type { NodeInitProgress } from "shared/types/node-init";

type MutationOptions = Parameters<
	typeof electronTrpc.nodes.create.useMutation
>[0];

interface UseCreateNodeOptions extends NonNullable<MutationOptions> {
	skipNavigation?: boolean;
}

export function useCreateNode(options?: UseCreateNodeOptions) {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const addPendingTerminalSetup = useNodeInitStore(
		(s) => s.addPendingTerminalSetup,
	);
	const updateProgress = useNodeInitStore((s) => s.updateProgress);

	return electronTrpc.nodes.create.useMutation({
		...options,
		onSuccess: async (data, ...rest) => {
			// Set optimistic progress before navigation to prevent "Setup incomplete" flash
			if (data.isInitializing) {
				const optimisticProgress: NodeInitProgress = {
					nodeId: data.node.id,
					repositoryId: data.repositoryId,
					step: "pending",
					message: "Preparing...",
				};
				updateProgress(optimisticProgress);
			}

			addPendingTerminalSetup({
				nodeId: data.node.id,
				repositoryId: data.repositoryId,
				initialCommands: data.initialCommands,
			});

			await utils.nodes.invalidate();

			if (!options?.skipNavigation) {
				navigateToNode(data.node.id, navigate);
			}

			await options?.onSuccess?.(data, ...rest);
		},
	});
}
