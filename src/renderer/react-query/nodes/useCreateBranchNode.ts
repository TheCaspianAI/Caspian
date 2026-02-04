import { useNavigate } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useNodeInitStore } from "renderer/stores/node-init";
import type { NodeInitProgress } from "shared/types/node-init";

export function useCreateBranchNode(
	options?: Parameters<typeof electronTrpc.nodes.createBranchNode.useMutation>[0],
) {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const addPendingTerminalSetup = useNodeInitStore((s) => s.addPendingTerminalSetup);
	const updateProgress = useNodeInitStore((s) => s.updateProgress);

	return electronTrpc.nodes.createBranchNode.useMutation({
		...options,
		onSuccess: async (data, ...rest) => {
			await utils.nodes.invalidate();

			if (!data.wasExisting) {
				let setupData = null;
				try {
					setupData = await utils.nodes.getSetupCommands.fetch({
						nodeId: data.node.id,
					});
				} catch (error) {
					console.error("[useCreateBranchNode] Failed to fetch setup commands:", error);
				}

				addPendingTerminalSetup({
					nodeId: data.node.id,
					repositoryId: data.repositoryId,
					initialCommands: setupData?.initialCommands ?? null,
					defaultPreset: setupData?.defaultPreset ?? null,
				});

				// Branch nodes skip git init, so mark ready immediately to trigger terminal setup
				const readyProgress: NodeInitProgress = {
					nodeId: data.node.id,
					repositoryId: data.repositoryId,
					step: "ready",
					message: "Ready",
				};
				updateProgress(readyProgress);
			}

			navigateToNode(data.node.id, navigate);
			await options?.onSuccess?.(data, ...rest);
		},
	});
}
