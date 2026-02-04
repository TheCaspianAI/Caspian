import type { NotificationIds } from "shared/notification-types";
import type { Pane, Tab } from "../types";

interface TabsState {
	panes: Record<string, Pane>;
	tabs: Tab[];
}

interface ResolvedTarget extends NotificationIds {
	nodeId: string; // Required in resolved target
}

/**
 * Resolves notification target IDs by looking up missing values from state.
 * Priority: event data > pane's tab > tab's node
 */
export function resolveNotificationTarget(
	ids: NotificationIds | undefined,
	state: TabsState,
): ResolvedTarget | null {
	if (!ids) return null;

	const { paneId, tabId, nodeId } = ids;

	const pane = paneId ? state.panes[paneId] : undefined;

	// Resolve tabId: prefer pane's tabId, fallback to event tabId
	const resolvedTabId = pane?.tabId ?? tabId;

	const tab = resolvedTabId ? state.tabs.find((t) => t.id === resolvedTabId) : undefined;

	// Resolve nodeId: prefer event, fallback to tab's node
	const resolvedNodeId = nodeId || tab?.nodeId;

	if (!resolvedNodeId) return null;

	return {
		paneId,
		tabId: resolvedTabId,
		nodeId: resolvedNodeId,
	};
}
