import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { OnboardingScreen } from "renderer/screens/main/components/OnboardingScreen";
import { StartView } from "renderer/screens/main/components/StartView";
import { Spinner } from "ui/components/ui/spinner";

const ONBOARDING_SEEN_KEY = "caspian-onboarding-seen";

export const Route = createFileRoute("/_authenticated/_dashboard/node/")({
	component: NodeIndexPage,
});

function LoadingSpinner() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<Spinner className="size-5" />
		</div>
	);
}

function NodeIndexPage() {
	const navigate = useNavigate();
	const { data: nodes, isLoading } = electronTrpc.nodes.getAllGrouped.useQuery();

	const allNodes = nodes?.flatMap((group: { nodes: Array<{ id: string }> }) => group.nodes) ?? [];
	const hasNoNodes = !isLoading && allNodes.length === 0;

	// Onboarding state - show only for first-time users with no nodes
	const [showOnboarding, setShowOnboarding] = useState(() => {
		return !localStorage.getItem(ONBOARDING_SEEN_KEY);
	});

	const handleOnboardingComplete = () => {
		localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
		setShowOnboarding(false);
	};

	useEffect(() => {
		if (isLoading || !nodes) return;
		if (allNodes.length === 0) return; // Show StartView instead

		// Try to restore last viewed node
		const lastViewedId = localStorage.getItem("lastViewedNodeId");
		const targetNode = allNodes.find((n: { id: string }) => n.id === lastViewedId) ?? allNodes[0];

		if (targetNode) {
			navigate({
				to: "/node/$nodeId",
				params: { nodeId: targetNode.id },
				replace: true,
			});
		}
	}, [nodes, isLoading, navigate, allNodes]);

	// Show onboarding first for new users with no nodes
	if (hasNoNodes && showOnboarding) {
		return <OnboardingScreen onContinue={handleOnboardingComplete} />;
	}

	if (hasNoNodes) {
		return <StartView />;
	}

	return <LoadingSpinner />;
}
