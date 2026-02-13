import { afterEach, describe, expect, test } from "bun:test";
import {
	COLLAPSED_SIDEBAR_WIDTH,
	MAX_SIDEBAR_WIDTH,
	MIN_SIDEBAR_WIDTH,
	SidebarTab,
	useSidebarStore,
} from "./sidebar-state";

// Reset the store to defaults between tests
afterEach(() => {
	useSidebarStore.setState({
		isSidebarOpen: true,
		isSidebarCollapsed: false,
		sidebarWidth: 250,
		lastOpenSidebarWidth: 250,
		isResizing: false,
		activeSidebarTab: SidebarTab.Nodes,
	});
});

describe("sidebar-state constants", () => {
	test("MIN_SIDEBAR_WIDTH is 200", () => {
		expect(MIN_SIDEBAR_WIDTH).toBe(200);
	});

	test("MAX_SIDEBAR_WIDTH is 500", () => {
		expect(MAX_SIDEBAR_WIDTH).toBe(500);
	});

	test("COLLAPSED_SIDEBAR_WIDTH is 52", () => {
		expect(COLLAPSED_SIDEBAR_WIDTH).toBe(52);
	});
});

describe("SidebarTab enum", () => {
	test("has Nodes, Changes, Files values", () => {
		expect(SidebarTab.Nodes as string).toBe("nodes");
		expect(SidebarTab.Changes as string).toBe("changes");
		expect(SidebarTab.Files as string).toBe("files");
	});
});

describe("toggleSidebar", () => {
	test("closes an open sidebar", () => {
		const store = useSidebarStore.getState();
		expect(store.isSidebarOpen).toBe(true);
		expect(store.isSidebarCollapsed).toBe(false);

		store.toggleSidebar();

		const updated = useSidebarStore.getState();
		expect(updated.isSidebarOpen).toBe(false);
		expect(updated.sidebarWidth).toBe(0);
	});

	test("opens a closed sidebar to last open width", () => {
		useSidebarStore.setState({
			isSidebarOpen: false,
			sidebarWidth: 0,
			lastOpenSidebarWidth: 300,
		});

		useSidebarStore.getState().toggleSidebar();

		const updated = useSidebarStore.getState();
		expect(updated.isSidebarOpen).toBe(true);
		expect(updated.isSidebarCollapsed).toBe(false);
		expect(updated.sidebarWidth).toBe(300);
	});

	test("opens a collapsed sidebar to last open width", () => {
		useSidebarStore.setState({
			isSidebarOpen: true,
			isSidebarCollapsed: true,
			sidebarWidth: COLLAPSED_SIDEBAR_WIDTH,
			lastOpenSidebarWidth: 350,
		});

		useSidebarStore.getState().toggleSidebar();

		const updated = useSidebarStore.getState();
		expect(updated.isSidebarOpen).toBe(true);
		expect(updated.isSidebarCollapsed).toBe(false);
		expect(updated.sidebarWidth).toBe(350);
	});
});

describe("setSidebarWidth", () => {
	test("snaps to collapsed when width <= 120", () => {
		useSidebarStore.getState().setSidebarWidth(100);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(COLLAPSED_SIDEBAR_WIDTH);
		expect(state.isSidebarCollapsed).toBe(true);
		expect(state.isSidebarOpen).toBe(true);
	});

	test("snaps to collapsed at exactly 120", () => {
		useSidebarStore.getState().setSidebarWidth(120);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(COLLAPSED_SIDEBAR_WIDTH);
		expect(state.isSidebarCollapsed).toBe(true);
	});

	test("clamps to MIN_SIDEBAR_WIDTH when just above threshold", () => {
		useSidebarStore.getState().setSidebarWidth(121);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(MIN_SIDEBAR_WIDTH);
		expect(state.isSidebarCollapsed).toBe(false);
	});

	test("clamps to MAX_SIDEBAR_WIDTH when too wide", () => {
		useSidebarStore.getState().setSidebarWidth(800);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(MAX_SIDEBAR_WIDTH);
	});

	test("updates lastOpenSidebarWidth for normal widths", () => {
		useSidebarStore.getState().setSidebarWidth(350);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(350);
		expect(state.lastOpenSidebarWidth).toBe(350);
		expect(state.isSidebarCollapsed).toBe(false);
		expect(state.isSidebarOpen).toBe(true);
	});

	test("does not update lastOpenSidebarWidth when snapping to collapsed", () => {
		useSidebarStore.setState({ lastOpenSidebarWidth: 300 });
		useSidebarStore.getState().setSidebarWidth(50);

		const state = useSidebarStore.getState();
		expect(state.sidebarWidth).toBe(COLLAPSED_SIDEBAR_WIDTH);
		expect(state.lastOpenSidebarWidth).toBe(300);
	});
});

describe("setSidebarOpen", () => {
	test("opening restores lastOpenSidebarWidth", () => {
		useSidebarStore.setState({
			isSidebarOpen: false,
			sidebarWidth: 0,
			lastOpenSidebarWidth: 400,
		});

		useSidebarStore.getState().setSidebarOpen(true);

		const state = useSidebarStore.getState();
		expect(state.isSidebarOpen).toBe(true);
		expect(state.sidebarWidth).toBe(400);
		expect(state.isSidebarCollapsed).toBe(false);
	});

	test("closing sets width to 0", () => {
		useSidebarStore.getState().setSidebarOpen(false);

		const state = useSidebarStore.getState();
		expect(state.isSidebarOpen).toBe(false);
		expect(state.sidebarWidth).toBe(0);
	});
});

describe("setActiveSidebarTab", () => {
	test("switches between tabs", () => {
		useSidebarStore.getState().setActiveSidebarTab(SidebarTab.Changes);
		expect(useSidebarStore.getState().activeSidebarTab).toBe(SidebarTab.Changes);

		useSidebarStore.getState().setActiveSidebarTab(SidebarTab.Files);
		expect(useSidebarStore.getState().activeSidebarTab).toBe(SidebarTab.Files);

		useSidebarStore.getState().setActiveSidebarTab(SidebarTab.Nodes);
		expect(useSidebarStore.getState().activeSidebarTab).toBe(SidebarTab.Nodes);
	});
});
