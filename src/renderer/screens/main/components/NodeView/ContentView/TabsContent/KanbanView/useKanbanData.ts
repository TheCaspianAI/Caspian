import { useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useTabsStore } from "renderer/stores/tabs/store";
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
		case "idle":
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

export function useKanbanData() {
	const { data: groupedData } = electronTrpc.nodes.getAllGrouped.useQuery();
	// Use separate selectors to avoid creating new object references on every render
	const panes = useTabsStore((s) => s.panes);
	const tabs = useTabsStore((s) => s.tabs);

	const agents = useMemo<AgentCardData[]>(() => {
		if (!groupedData) return [];

		// Pre-compute panes by tab ID for O(1) lookup
		const panesByTabId = new Map<string, Array<{ id: string; status: PaneStatus | undefined }>>();
		for (const pane of Object.values(panes)) {
			if (pane.type === "terminal") {
				const existing = panesByTabId.get(pane.tabId) || [];
				existing.push({ id: pane.id, status: pane.status });
				panesByTabId.set(pane.tabId, existing);
			}
		}

		const result: AgentCardData[] = [];

		for (const group of groupedData) {
			for (const node of group.nodes) {
				// Find panes for this node
				const nodeTabs = tabs.filter((t) => t.nodeId === node.id);
				const nodePaneIds = nodeTabs.flatMap((t) =>
					(panesByTabId.get(t.id) || []).map((p) => p.id)
				);

				// Get highest priority status from all panes
				let highestStatus: PaneStatus = "idle";
				let activePaneId = "";
				let activeTabId = "";

				for (const paneId of nodePaneIds) {
					const pane = panes[paneId];
					if (!pane) continue;

					const paneStatus = pane.status ?? "idle";
					// Priority: permission > working > review > idle
					if (
						paneStatus === "permission" ||
						(paneStatus === "working" && highestStatus !== "permission") ||
						(paneStatus === "review" && highestStatus === "idle")
					) {
						highestStatus = paneStatus;
						activePaneId = paneId;
						activeTabId = pane.tabId;
					} else if (!activePaneId && paneStatus === "idle") {
						activePaneId = paneId;
						activeTabId = pane.tabId;
					}
				}

				// Still show nodes without terminal panes
				if (!activePaneId && nodeTabs.length > 0) {
					activePaneId = "";
					activeTabId = nodeTabs[0].id;
				}

				result.push({
					nodeId: node.id,
					nodeName: node.name,
					paneId: activePaneId,
					tabId: activeTabId,
					repositoryId: group.repository.id,
					repositoryName: group.repository.name,
					repositoryColor: group.repository.color,
					branch: node.branch,
					status: mapPaneStatusToAgentStatus(highestStatus),
					duration:
						highestStatus === "working"
							? formatDuration(node.updatedAt)
							: undefined,
					gitInfo: {
						baseBranch: group.repository.defaultBranch,
					},
				});
			}
		}

		return result;
	}, [groupedData, panes, tabs]);

	const columns = useMemo(() => {
		const running = agents.filter((a) => a.status === "running");
		const waiting = agents.filter((a) => a.status === "waiting");
		const idle = agents.filter(
			(a) =>
				a.status === "completed" || a.status === "idle" || a.status === "error"
		);

		return {
			running,
			waiting,
			idle,
		};
	}, [agents]);

	return { agents, columns };
}
