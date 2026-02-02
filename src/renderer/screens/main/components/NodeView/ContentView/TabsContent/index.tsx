import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import { resolveActiveTabIdForNode } from "renderer/stores/tabs/utils";
import { EmptyTabView } from "./EmptyTabView";
import { TabView } from "./TabView";

export function TabsContent() {
	const { workspaceId: activeWorkspaceId } = useParams({ strict: false });
	const allTabs = useTabsStore((s) => s.tabs);
	const activeTabIds = useTabsStore((s) => s.activeTabIds);
	const tabHistoryStacks = useTabsStore((s) => s.tabHistoryStacks);

	const activeTabId = useMemo(() => {
		if (!activeWorkspaceId) return null;

		const resolvedActiveTabId = resolveActiveTabIdForNode({
			nodeId: activeWorkspaceId,
			tabs: allTabs,
			activeTabIds,
			tabHistoryStacks,
		});
		if (!resolvedActiveTabId) return null;

		const tab = allTabs.find((t) => t.id === resolvedActiveTabId) || null;
		if (!tab || tab.nodeId !== activeWorkspaceId) return null;
		return resolvedActiveTabId;
	}, [activeWorkspaceId, activeTabIds, allTabs, tabHistoryStacks]);

	const tabToRender = useMemo(() => {
		if (!activeTabId) return null;
		return allTabs.find((tab) => tab.id === activeTabId) || null;
	}, [activeTabId, allTabs]);

	return (
		<div className="flex-1 min-h-0 flex overflow-hidden">
			{tabToRender ? <TabView tab={tabToRender} /> : <EmptyTabView />}
		</div>
	);
}
