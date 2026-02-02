import type {
	NavigateOptions,
	UseNavigateResult,
} from "@tanstack/react-router";

/**
 * Navigate to a node and update localStorage to remember it as the last viewed node.
 * This ensures the node will be restored when the app is reopened.
 *
 * @param nodeId - The ID of the node to navigate to
 * @param navigate - The navigate function from useNavigate()
 * @param options - Optional navigation options (replace, resetScroll, etc.)
 */
export function navigateToNode(
	nodeId: string,
	navigate: UseNavigateResult<string>,
	options?: Omit<NavigateOptions, "to" | "params">,
): Promise<void> {
	localStorage.setItem("lastViewedNodeId", nodeId);
	return navigate({
		to: "/workspace/$workspaceId",
		params: { workspaceId: nodeId },
		...options,
	});
}
