import { useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useTabsStore } from "renderer/stores/tabs/store";
import { getTabDisplayName } from "renderer/stores/tabs/utils";
import type { PaneStatus } from "shared/tabs-types";
import type { AgentCardData, AgentStatus } from "./types";

function mapPaneStatusToAgentStatus(paneStatus: PaneStatus | undefined): AgentStatus {
	switch (paneStatus) {
		case "working":
			return "running";
		case "permission":
			return "waiting";
		case "review":
			return "completed";
		default:
			return "idle";
	}
}

function formatDuration(startTime: number): string {
	const now = Date.now();
	const diffMs = now - startTime;
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return "< 1m";
	if (diffMins < 60) return `${diffMins}m`;

	const hours = Math.floor(diffMins / 60);
	const mins = diffMins % 60;
	return `${hours}h ${mins}m`;
}

export function useAgentsData() {
	const { data: groupedData } = electronTrpc.nodes.getAllGrouped.useQuery();
	// Use separate selectors to avoid creating new object references on every render
	const panes = useTabsStore((s) => s.panes);
	const tabs = useTabsStore((s) => s.tabs);

	const agents = useMemo<AgentCardData[]>(() => {
		if (!groupedData) return [];

		// Build lookup maps for O(1) access
		const nodeById = new Map<
			string,
			{
				node: (typeof groupedData)[0]["nodes"][0];
				repository: (typeof groupedData)[0]["repository"];
			}
		>();
		for (const group of groupedData) {
			for (const node of group.nodes) {
				nodeById.set(node.id, { node, repository: group.repository });
			}
		}

		const tabById = new Map(tabs.map((t) => [t.id, t]));

		const result: AgentCardData[] = [];

		// Iterate over all terminal panes - each becomes an agent card
		for (const pane of Object.values(panes)) {
			// Only show terminal panes as agents
			if (pane.type !== "terminal") continue;

			const tab = tabById.get(pane.tabId);
			if (!tab) continue;

			const nodeInfo = nodeById.get(tab.nodeId);
			if (!nodeInfo) continue;

			const { node, repository } = nodeInfo;

			// Get agent name from pane name (if it's not the default "Terminal")
			// Fall back to tab display name
			const agentName = pane.name && pane.name !== "Terminal" ? pane.name : getTabDisplayName(tab);

			result.push({
				agentName,
				paneId: pane.id,
				tabId: pane.tabId,
				nodeId: node.id,
				nodeName: node.name || node.branch,
				branch: node.branch,
				repositoryId: repository.id,
				repositoryName: repository.name,
				repositoryColor: repository.color,
				status: mapPaneStatusToAgentStatus(pane.status),
				duration: pane.status === "working" ? formatDuration(tab.createdAt) : undefined,
			});
		}

		return result;
	}, [groupedData, panes, tabs]);

	const columns = useMemo(() => {
		const running = agents.filter((a) => a.status === "running");
		const waiting = agents.filter((a) => a.status === "waiting");
		const completed = agents.filter((a) => a.status === "completed");
		const idle = agents.filter((a) => a.status === "idle" || a.status === "error");

		return {
			running,
			waiting,
			completed,
			idle,
		};
	}, [agents]);

	return { agents, columns };
}
