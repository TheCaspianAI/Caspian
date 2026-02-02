import { toast } from "ui/components/ui/sonner";
import { useNavigate } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useOpenConfigModal } from "renderer/stores/config-modal";
import { useTabsStore } from "renderer/stores/tabs/store";

/**
 * Mutation hook for opening an existing worktree as a new node
 * Automatically invalidates all node queries on success
 * Creates a terminal tab with setup commands if present
 * Shows config toast if no setup commands are configured
 */
export function useOpenWorktree(
	options?: Parameters<
		typeof electronTrpc.nodes.openWorktree.useMutation
	>[0],
) {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const addTab = useTabsStore((state) => state.addTab);
	const setTabAutoTitle = useTabsStore((state) => state.setTabAutoTitle);
	const createOrAttach = electronTrpc.terminal.createOrAttach.useMutation();
	const openConfigModal = useOpenConfigModal();
	const dismissConfigToast =
		electronTrpc.config.dismissConfigToast.useMutation();

	return electronTrpc.nodes.openWorktree.useMutation({
		...options,
		onSuccess: async (data, ...rest) => {
			// Auto-invalidate all node queries
			await utils.nodes.invalidate();
			// Invalidate repository queries since openWorktree updates repository metadata
			await utils.repositories.getRecents.invalidate();

			const initialCommands =
				Array.isArray(data.initialCommands) && data.initialCommands.length > 0
					? data.initialCommands
					: undefined;

			// Always create a terminal tab when opening a worktree
			const { tabId, paneId } = addTab(data.node.id);
			if (initialCommands) {
				setTabAutoTitle(tabId, "Node Setup");
			}
			// Pre-create terminal session (with initial commands if present)
			// Terminal component will attach to this session when it mounts
			createOrAttach.mutate({
				paneId,
				tabId,
				nodeId: data.node.id,
				initialCommands,
			});

			if (!initialCommands) {
				// Show config toast if no setup commands
				toast.info("No setup script configured", {
					description: "Automate node setup with a config.json file",
					action: {
						label: "Configure",
						onClick: () => openConfigModal(data.repositoryId),
					},
					onDismiss: () => {
						dismissConfigToast.mutate({ repositoryId: data.repositoryId });
					},
				});
			}

			// Navigate to the opened node
			navigateToNode(data.node.id, navigate);

			// Call user's onSuccess if provided
			await options?.onSuccess?.(data, ...rest);
		},
	});
}
