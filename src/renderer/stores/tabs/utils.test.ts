import { describe, expect, it } from "bun:test";
import type { MosaicNode } from "react-mosaic-component";
import type { Tab } from "./types";
import {
	addPaneToLayout,
	buildMultiPaneLayout,
	cleanLayout,
	extractPaneIdsFromLayout,
	findPanePath,
	generateTabName,
	getAdjacentPaneId,
	getFirstPaneId,
	getNextPaneId,
	getPaneIdsForTab,
	getPreviousPaneId,
	getTabDisplayName,
	isLastPaneInTab,
	removePaneFromLayout,
	resolveActiveTabIdForNode,
	resolveFileViewerMode,
	updateHistoryStack,
} from "./utils";

describe("resolveFileViewerMode", () => {
	it("returns explicit viewMode if provided", () => {
		expect(resolveFileViewerMode({ filePath: "file.ts", viewMode: "raw" })).toBe("raw");
		expect(resolveFileViewerMode({ filePath: "file.md", viewMode: "raw" })).toBe("raw");
	});

	it("returns diff mode if diffCategory is provided", () => {
		expect(resolveFileViewerMode({ filePath: "file.ts", diffCategory: "staged" })).toBe("diff");
		expect(resolveFileViewerMode({ filePath: "file.ts", diffCategory: "unstaged" })).toBe("diff");
	});

	it("returns rendered for markdown files", () => {
		expect(resolveFileViewerMode({ filePath: "README.md" })).toBe("rendered");
		expect(resolveFileViewerMode({ filePath: "docs.markdown" })).toBe("rendered");
		expect(resolveFileViewerMode({ filePath: "page.mdx" })).toBe("rendered");
	});

	it("returns raw for non-markdown files", () => {
		expect(resolveFileViewerMode({ filePath: "file.ts" })).toBe("raw");
		expect(resolveFileViewerMode({ filePath: "file.json" })).toBe("raw");
		expect(resolveFileViewerMode({ filePath: "file.txt" })).toBe("raw");
	});
});

describe("getTabDisplayName", () => {
	it("returns userTitle if set", () => {
		const tab = { userTitle: "My Tab", name: "Terminal 1" } as Tab;
		expect(getTabDisplayName(tab)).toBe("My Tab");
	});

	it("trims userTitle", () => {
		const tab = { userTitle: "  My Tab  ", name: "Terminal 1" } as Tab;
		expect(getTabDisplayName(tab)).toBe("My Tab");
	});

	it("returns name if userTitle is empty", () => {
		const tab = { userTitle: "", name: "Terminal 1" } as Tab;
		expect(getTabDisplayName(tab)).toBe("Terminal 1");
	});

	it("returns name if userTitle is whitespace only", () => {
		const tab = { userTitle: "   ", name: "Terminal 1" } as Tab;
		expect(getTabDisplayName(tab)).toBe("Terminal 1");
	});

	it("extracts last directory from path-like names", () => {
		const tab = { name: "/path/to/project" } as Tab;
		expect(getTabDisplayName(tab)).toBe("project");
	});

	it("returns Terminal as fallback", () => {
		const tab = { name: "" } as Tab;
		expect(getTabDisplayName(tab)).toBe("Terminal");
		const tab2 = {} as Tab;
		expect(getTabDisplayName(tab2)).toBe("Terminal");
	});
});

describe("resolveActiveTabIdForNode", () => {
	const tabs: Tab[] = [
		{ id: "tab-1", nodeId: "node-1" } as Tab,
		{ id: "tab-2", nodeId: "node-1" } as Tab,
		{ id: "tab-3", nodeId: "node-2" } as Tab,
	];

	it("returns current activeTabId if valid for node", () => {
		const result = resolveActiveTabIdForNode({
			nodeId: "node-1",
			tabs,
			activeTabIds: { "node-1": "tab-2" },
			tabHistoryStacks: {},
		});
		expect(result).toBe("tab-2");
	});

	it("falls back to history stack if activeTabId is invalid", () => {
		const result = resolveActiveTabIdForNode({
			nodeId: "node-1",
			tabs,
			activeTabIds: { "node-1": "invalid-tab" },
			tabHistoryStacks: { "node-1": ["tab-2", "tab-1"] },
		});
		expect(result).toBe("tab-2");
	});

	it("falls back to first tab if no valid activeTabId or history", () => {
		const result = resolveActiveTabIdForNode({
			nodeId: "node-1",
			tabs,
			activeTabIds: {},
			tabHistoryStacks: {},
		});
		expect(result).toBe("tab-1");
	});

	it("returns null if node has no tabs", () => {
		const result = resolveActiveTabIdForNode({
			nodeId: "non-existent",
			tabs,
			activeTabIds: {},
			tabHistoryStacks: {},
		});
		expect(result).toBeNull();
	});
});

describe("extractPaneIdsFromLayout", () => {
	it("returns single pane ID for leaf node", () => {
		expect(extractPaneIdsFromLayout("pane-1")).toEqual(["pane-1"]);
	});

	it("returns pane IDs in visual order for horizontal split", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "pane-1",
			second: "pane-2",
		};
		expect(extractPaneIdsFromLayout(layout)).toEqual(["pane-1", "pane-2"]);
	});

	it("returns pane IDs in visual order for vertical split", () => {
		const layout: MosaicNode<string> = {
			direction: "column",
			first: "pane-top",
			second: "pane-bottom",
		};
		expect(extractPaneIdsFromLayout(layout)).toEqual(["pane-top", "pane-bottom"]);
	});

	it("handles nested layouts", () => {
		const layout: MosaicNode<string> = {
			direction: "column",
			first: {
				direction: "row",
				first: "pane-tl",
				second: "pane-tr",
			},
			second: {
				direction: "row",
				first: "pane-bl",
				second: "pane-br",
			},
		};
		expect(extractPaneIdsFromLayout(layout)).toEqual(["pane-tl", "pane-tr", "pane-bl", "pane-br"]);
	});
});

describe("generateTabName", () => {
	it("returns Terminal 1 for empty array", () => {
		expect(generateTabName([])).toBe("Terminal 1");
	});

	it("finds next available number", () => {
		const tabs = [{ name: "Terminal 1" }, { name: "Terminal 2" }] as Tab[];
		expect(generateTabName(tabs)).toBe("Terminal 3");
	});

	it("fills gaps in numbering", () => {
		const tabs = [{ name: "Terminal 1" }, { name: "Terminal 3" }] as Tab[];
		expect(generateTabName(tabs)).toBe("Terminal 2");
	});

	it("ignores non-numbered tabs", () => {
		const tabs = [{ name: "Custom Tab" }, { name: "Terminal 1" }] as Tab[];
		expect(generateTabName(tabs)).toBe("Terminal 2");
	});
});

describe("getPaneIdsForTab", () => {
	const panes = {
		"pane-1": { id: "pane-1", tabId: "tab-1" },
		"pane-2": { id: "pane-2", tabId: "tab-1" },
		"pane-3": { id: "pane-3", tabId: "tab-2" },
	} as Record<string, { id: string; tabId: string }>;

	it("returns pane IDs for a specific tab", () => {
		expect(getPaneIdsForTab(panes as never, "tab-1")).toEqual(["pane-1", "pane-2"]);
	});

	it("returns empty array for non-existent tab", () => {
		expect(getPaneIdsForTab(panes as never, "non-existent")).toEqual([]);
	});
});

describe("isLastPaneInTab", () => {
	it("returns true if tab has only one pane", () => {
		const panes = {
			"pane-1": { id: "pane-1", tabId: "tab-1" },
		} as Record<string, { id: string; tabId: string }>;
		expect(isLastPaneInTab(panes as never, "tab-1")).toBe(true);
	});

	it("returns false if tab has multiple panes", () => {
		const panes = {
			"pane-1": { id: "pane-1", tabId: "tab-1" },
			"pane-2": { id: "pane-2", tabId: "tab-1" },
		} as Record<string, { id: string; tabId: string }>;
		expect(isLastPaneInTab(panes as never, "tab-1")).toBe(false);
	});
});

describe("removePaneFromLayout", () => {
	it("returns null when removing only pane", () => {
		expect(removePaneFromLayout("pane-1", "pane-1")).toBeNull();
	});

	it("returns other pane when removing from 2-pane layout", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "pane-1",
			second: "pane-2",
		};
		expect(removePaneFromLayout(layout, "pane-1")).toBe("pane-2");
		expect(removePaneFromLayout(layout, "pane-2")).toBe("pane-1");
	});

	it("handles nested layouts", () => {
		const layout: MosaicNode<string> = {
			direction: "column",
			first: {
				direction: "row",
				first: "pane-1",
				second: "pane-2",
			},
			second: "pane-3",
		};
		const result = removePaneFromLayout(layout, "pane-2");
		expect(result).toEqual({
			direction: "column",
			first: "pane-1",
			second: "pane-3",
		});
	});

	it("returns null for null layout", () => {
		expect(removePaneFromLayout(null, "pane-1")).toBeNull();
	});
});

describe("cleanLayout", () => {
	it("returns null for null layout", () => {
		expect(cleanLayout(null, new Set(["pane-1"]))).toBeNull();
	});

	it("keeps valid leaf node", () => {
		expect(cleanLayout("pane-1", new Set(["pane-1"]))).toBe("pane-1");
	});

	it("removes invalid leaf node", () => {
		expect(cleanLayout("invalid", new Set(["pane-1"]))).toBeNull();
	});

	it("cleans nested layouts", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "valid",
			second: "invalid",
		};
		expect(cleanLayout(layout, new Set(["valid"]))).toBe("valid");
	});
});

describe("getFirstPaneId", () => {
	it("returns the ID for leaf node", () => {
		expect(getFirstPaneId("pane-1")).toBe("pane-1");
	});

	it("returns first pane in nested layout", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "pane-1",
			second: "pane-2",
		};
		expect(getFirstPaneId(layout)).toBe("pane-1");
	});
});

describe("getNextPaneId", () => {
	const layout: MosaicNode<string> = {
		direction: "row",
		first: "pane-1",
		second: "pane-2",
	};

	it("returns next pane in order", () => {
		expect(getNextPaneId(layout, "pane-1")).toBe("pane-2");
	});

	it("wraps around to first pane", () => {
		expect(getNextPaneId(layout, "pane-2")).toBe("pane-1");
	});

	it("returns null for single-pane layout", () => {
		expect(getNextPaneId("pane-1", "pane-1")).toBeNull();
	});

	it("returns first pane if current not found", () => {
		expect(getNextPaneId(layout, "invalid")).toBe("pane-1");
	});
});

describe("getPreviousPaneId", () => {
	const layout: MosaicNode<string> = {
		direction: "row",
		first: "pane-1",
		second: "pane-2",
	};

	it("returns previous pane in order", () => {
		expect(getPreviousPaneId(layout, "pane-2")).toBe("pane-1");
	});

	it("wraps around to last pane", () => {
		expect(getPreviousPaneId(layout, "pane-1")).toBe("pane-2");
	});

	it("returns null for single-pane layout", () => {
		expect(getPreviousPaneId("pane-1", "pane-1")).toBeNull();
	});

	it("returns last pane if current not found", () => {
		expect(getPreviousPaneId(layout, "invalid")).toBe("pane-2");
	});
});

describe("getAdjacentPaneId", () => {
	const layout: MosaicNode<string> = {
		direction: "row",
		first: "pane-1",
		second: "pane-2",
	};

	it("returns next pane when closing first", () => {
		expect(getAdjacentPaneId(layout, "pane-1")).toBe("pane-2");
	});

	it("returns previous pane when closing last", () => {
		expect(getAdjacentPaneId(layout, "pane-2")).toBe("pane-1");
	});

	it("returns null for single-pane layout", () => {
		expect(getAdjacentPaneId("pane-1", "pane-1")).toBeNull();
	});
});

describe("findPanePath", () => {
	it("returns empty array for leaf node match", () => {
		expect(findPanePath("pane-1", "pane-1")).toEqual([]);
	});

	it("returns null for leaf node mismatch", () => {
		expect(findPanePath("pane-1", "pane-2")).toBeNull();
	});

	it("returns path for first child", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "pane-1",
			second: "pane-2",
		};
		expect(findPanePath(layout, "pane-1")).toEqual(["first"]);
	});

	it("returns path for second child", () => {
		const layout: MosaicNode<string> = {
			direction: "row",
			first: "pane-1",
			second: "pane-2",
		};
		expect(findPanePath(layout, "pane-2")).toEqual(["second"]);
	});

	it("returns nested path", () => {
		const layout: MosaicNode<string> = {
			direction: "column",
			first: {
				direction: "row",
				first: "pane-tl",
				second: "pane-tr",
			},
			second: "pane-bottom",
		};
		expect(findPanePath(layout, "pane-tr")).toEqual(["first", "second"]);
	});
});

describe("addPaneToLayout", () => {
	it("creates a row split", () => {
		const result = addPaneToLayout("pane-1", "pane-2");
		expect(result).toEqual({
			direction: "row",
			first: "pane-1",
			second: "pane-2",
			splitPercentage: 50,
		});
	});
});

describe("buildMultiPaneLayout", () => {
	it("throws for empty array", () => {
		expect(() => buildMultiPaneLayout([])).toThrow();
	});

	it("returns single pane for 1-element array", () => {
		expect(buildMultiPaneLayout(["pane-1"])).toBe("pane-1");
	});

	it("returns row split for 2 panes", () => {
		expect(buildMultiPaneLayout(["pane-1", "pane-2"])).toEqual({
			direction: "row",
			first: "pane-1",
			second: "pane-2",
			splitPercentage: 50,
		});
	});

	it("creates balanced layout for multiple panes", () => {
		const result = buildMultiPaneLayout(["p1", "p2", "p3", "p4"]);
		expect(extractPaneIdsFromLayout(result)).toEqual(["p1", "p2", "p3", "p4"]);
	});
});

describe("updateHistoryStack", () => {
	it("removes new active from history", () => {
		const result = updateHistoryStack(["tab-1", "tab-2", "tab-3"], null, "tab-2");
		expect(result).not.toContain("tab-2");
	});

	it("adds current active to front of history", () => {
		const result = updateHistoryStack(["tab-2"], "tab-1", "tab-3");
		expect(result[0]).toBe("tab-1");
	});

	it("removes specified tab from history", () => {
		const result = updateHistoryStack(["tab-1", "tab-2"], null, "tab-3", "tab-1");
		expect(result).not.toContain("tab-1");
	});

	it("doesn't duplicate current active in history", () => {
		const result = updateHistoryStack(["tab-1", "tab-2"], "tab-1", "tab-3");
		const countTab1 = result.filter((id) => id === "tab-1").length;
		expect(countTab1).toBe(1);
	});
});
