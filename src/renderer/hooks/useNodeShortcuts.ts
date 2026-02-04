import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { useAppHotkey } from "renderer/stores/hotkeys";

/**
 * Shared hook for node keyboard shortcuts.
 * Used by NodeSidebar for navigation between nodes.
 *
 * Handles Cmd+1-9 node switching shortcuts (global).
 */
export function useNodeShortcuts() {
	const { data: groups = [] } = electronTrpc.nodes.getAllGrouped.useQuery();
	const navigate = useNavigate();

	// Flatten nodes for keyboard navigation
	const allNodes = groups.flatMap((group) => group.nodes);

	const switchToNode = useCallback(
		(index: number) => {
			const node = allNodes[index];
			if (node) {
				navigateToNode(node.id, navigate);
			}
		},
		[allNodes, navigate],
	);

	useAppHotkey("JUMP_TO_NODE_1", () => switchToNode(0), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_2", () => switchToNode(1), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_3", () => switchToNode(2), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_4", () => switchToNode(3), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_5", () => switchToNode(4), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_6", () => switchToNode(5), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_7", () => switchToNode(6), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_8", () => switchToNode(7), undefined, [switchToNode]);
	useAppHotkey("JUMP_TO_NODE_9", () => switchToNode(8), undefined, [switchToNode]);

	return {
		groups,
		allNodes,
	};
}
