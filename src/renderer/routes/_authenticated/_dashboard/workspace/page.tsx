import { Spinner } from "ui/components/ui/spinner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { StartView } from "renderer/screens/main/components/StartView";

export const Route = createFileRoute("/_authenticated/_dashboard/workspace/")({
	component: WorkspaceIndexPage,
});

function LoadingSpinner() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<Spinner className="size-5" />
		</div>
	);
}

function WorkspaceIndexPage() {
	const navigate = useNavigate();
	const { data: nodes, isLoading } =
		electronTrpc.nodes.getAllGrouped.useQuery();

	const allNodes = nodes?.flatMap((group: { nodes: Array<{ id: string }> }) => group.nodes) ?? [];
	const hasNoNodes = !isLoading && allNodes.length === 0;

	useEffect(() => {
		if (isLoading || !nodes) return;
		if (allNodes.length === 0) return; // Show StartView instead

		// Try to restore last viewed node
		const lastViewedId = localStorage.getItem("lastViewedNodeId");
		const targetNode =
			allNodes.find((n: { id: string }) => n.id === lastViewedId) ?? allNodes[0];

		if (targetNode) {
			navigate({
				to: "/workspace/$workspaceId",
				params: { workspaceId: targetNode.id },
				replace: true,
			});
		}
	}, [nodes, isLoading, navigate, allNodes]);

	if (hasNoNodes) {
		return <StartView />;
	}

	return <LoadingSpinner />;
}
