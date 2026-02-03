/**
 * Extracts the node ID from a hash-routed URL.
 *
 * The app uses hash routing, so URLs look like:
 * - file:///path/to/app/index.html#/node/abc123
 * - file:///Users/foo/workspace/caspian/dist/index.html#/node/abc123?foo=bar
 *
 * This function parses the hash portion to avoid matching /node/ in the file path.
 */
export function extractNodeIdFromUrl(url: string): string | null {
	try {
		const hash = new URL(url).hash;
		const match = hash.match(/\/node\/([^/?#]+)/);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}

interface TabsState {
	activeTabIds?: Record<string, string | null>;
	focusedPaneIds?: Record<string, string>;
}

interface PaneLocation {
	nodeId: string;
	tabId: string;
	paneId: string;
}

/**
 * Determines if a pane is currently visible to the user.
 *
 * A pane is visible when:
 * 1. User is viewing the node containing the pane
 * 2. The tab is the active tab in that node
 * 3. The pane is the focused pane in that tab
 */
export function isPaneVisible({
	currentNodeId,
	tabsState,
	pane,
}: {
	currentNodeId: string | null;
	tabsState: TabsState | undefined;
	pane: PaneLocation;
}): boolean {
	if (!currentNodeId || !tabsState) {
		return false;
	}

	const isViewingNode = currentNodeId === pane.nodeId;
	const isActiveTab = tabsState.activeTabIds?.[pane.nodeId] === pane.tabId;
	const isFocusedPane = tabsState.focusedPaneIds?.[pane.tabId] === pane.paneId;

	return isViewingNode && isActiveTab && isFocusedPane;
}

interface BaseTab {
	id: string;
	name: string;
	userTitle?: string;
}

interface Pane {
	name: string;
}

/**
 * Derives a display title for a notification from tab/pane state.
 * Priority: tab.userTitle > tab.name > pane.name > "Terminal"
 */
export function getNotificationTitle({
	tabId,
	paneId,
	tabs,
	panes,
}: {
	tabId?: string;
	paneId?: string;
	tabs?: BaseTab[];
	panes?: Record<string, Pane>;
}): string {
	const tab = tabId ? tabs?.find((t) => t.id === tabId) : undefined;
	const pane = paneId ? panes?.[paneId] : undefined;
	return tab?.userTitle?.trim() || tab?.name || pane?.name || "Terminal";
}

interface Node {
	name: string | null;
	worktreeId: string | null;
}

interface Worktree {
	branch: string | null;
}

/**
 * Derives a display name for a node, falling back through available names.
 */
export function getNodeName({
	node,
	worktree,
}: {
	node?: Node | null;
	worktree?: Worktree | null;
}): string {
	return node?.name || worktree?.branch || "Node";
}
