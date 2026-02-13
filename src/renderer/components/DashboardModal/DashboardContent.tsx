import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import { StatusLane } from "./StatusLane";
import { useAgentsData } from "./useAgentsData";

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
			navigate({ to: "/node/$nodeId", params: { nodeId: nodeId } });

			if (paneId && tabId) {
				const targetTab = tabs.find((t) => t.id === tabId);
				if (targetTab) {
					setActiveTab(nodeId, targetTab.id);
					setFocusedPane(targetTab.id, paneId);
				}
			}

			onClose();
		},
		[navigate, tabs, setActiveTab, setFocusedPane, onClose],
	);

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Header */}
			<div className="flex items-center shrink-0 px-6 py-4 border-b border-border">
				<span className="text-section font-medium text-muted-foreground">Agents Dashboard</span>
			</div>

			{/* Lanes */}
			<div className="flex-1 min-h-0 overflow-x-auto">
				<div className="flex h-full divide-x divide-border">
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
