import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import { useAgentsData } from "./useAgentsData";
import { StatusLane } from "./StatusLane";

interface DashboardContentProps {
	onClose: () => void;
}

export function DashboardContent({ onClose }: DashboardContentProps) {
	const navigate = useNavigate();
	const { columns } = useAgentsData();
	const setActiveTab = useTabsStore((s) => s.setActiveTab);
	const setFocusedPane = useTabsStore((s) => s.setFocusedPane);
	const tabs = useTabsStore((s) => s.tabs);

	const handleAgentSelect = useCallback(
		(nodeId: string, paneId: string, tabId: string) => {
			// Navigate to the node
			navigate({ to: "/node/$nodeId", params: { nodeId: nodeId } });

			// If we have a specific pane, focus it
			if (paneId && tabId) {
				const targetTab = tabs.find((t) => t.id === tabId);
				if (targetTab) {
					setActiveTab(nodeId, targetTab.id);
					setFocusedPane(targetTab.id, paneId);
				}
			}

			// Close the modal
			onClose();
		},
		[navigate, tabs, setActiveTab, setFocusedPane, onClose]
	);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center px-4 py-3 border-b border-border/30">
				<span className="text-sm font-medium">Agents Dashboard</span>
			</div>

			{/* Lanes - lifecycle order: Running → Waiting → Completed → Idle */}
			<div className="flex-1 overflow-x-auto overflow-y-hidden">
				<div className="flex h-full p-4 gap-4">
					<StatusLane
						title="Running"
						status="running"
						agents={columns.running}
						emptyText="No active agents"
						onAgentSelect={handleAgentSelect}
					/>
					<StatusLane
						title="Waiting"
						status="waiting"
						agents={columns.waiting}
						emptyText="No blocked agents"
						onAgentSelect={handleAgentSelect}
					/>
					<StatusLane
						title="Completed"
						status="completed"
						agents={columns.completed}
						emptyText="No completed agents"
						onAgentSelect={handleAgentSelect}
					/>
					<StatusLane
						title="Idle"
						status="idle"
						agents={columns.idle}
						emptyText="No idle agents"
						onAgentSelect={handleAgentSelect}
					/>
				</div>
			</div>
		</div>
	);
}
