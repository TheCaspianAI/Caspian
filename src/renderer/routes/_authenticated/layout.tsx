import {
	createFileRoute,
	Outlet,
	useNavigate,
} from "@tanstack/react-router";
import { DndProvider } from "react-dnd";
import { DashboardModal } from "renderer/components/DashboardModal";
import { NewNodeModal } from "renderer/components/NewNodeModal";
import { NodeSwitcherModal } from "renderer/components/NodeSwitcherModal";
import { useUpdateListener } from "renderer/components/UpdateToast";
import { dragDropManager } from "renderer/lib/dnd";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { NodeInitEffects } from "renderer/screens/main/components/NodeInitEffects";
import { useHotkeysSync } from "renderer/stores/hotkeys";
import { useAgentHookListener } from "renderer/stores/tabs/useAgentHookListener";
import { useNodeInitStore } from "renderer/stores/node-init";
import { AgentHooks } from "./components/AgentHooks";
import { CollectionsProvider } from "./providers/CollectionsProvider";

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();

	// Global hooks and subscriptions (these don't need CollectionsProvider)
	useAgentHookListener();
	useUpdateListener();
	useHotkeysSync();

	// Node initialization progress subscription
	const updateInitProgress = useNodeInitStore((s) => s.updateProgress);
	electronTrpc.nodes.onInitProgress.useSubscription(undefined, {
		onData: (progress) => {
			updateInitProgress(progress);
			if (progress.step === "ready" || progress.step === "failed") {
				// Invalidate both the grouped list AND the specific node
				utils.nodes.getAllGrouped.invalidate();
				utils.nodes.get.invalidate({ id: progress.nodeId });
			}
		},
		onError: (error) => {
			console.error("[node-init-subscription] Subscription error:", error);
		},
	});

	// Menu navigation subscription
	electronTrpc.menu.subscribe.useSubscription(undefined, {
		onData: (event) => {
			if (event.type === "open-settings") {
				navigate({ to: "/settings" });
			} else if (event.type === "open-node") {
				navigate({ to: `/node/${event.data.nodeId}` });
			}
		},
	});

	return (
		<DndProvider manager={dragDropManager}>
			<CollectionsProvider>
				<AgentHooks />
				<Outlet />
				<NodeInitEffects />
				<DashboardModal />
				<NewNodeModal />
				<NodeSwitcherModal />
			</CollectionsProvider>
		</DndProvider>
	);
}
