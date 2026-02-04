import { describe, expect, it } from "bun:test";
import { resolveNotificationTarget } from "./resolve-notification-target";

describe("resolveNotificationTarget", () => {
	const createState = () => ({
		panes: {
			"pane-1": { id: "pane-1", tabId: "tab-1" },
			"pane-2": { id: "pane-2", tabId: "tab-2" },
		} as Record<string, { id: string; tabId: string }>,
		tabs: [
			{ id: "tab-1", nodeId: "node-1" },
			{ id: "tab-2", nodeId: "node-2" },
		],
	});

	it("returns null for undefined ids", () => {
		expect(resolveNotificationTarget(undefined, createState() as never)).toBeNull();
	});

	it("resolves nodeId from pane -> tab chain", () => {
		const result = resolveNotificationTarget({ paneId: "pane-1" }, createState() as never);
		expect(result).toEqual({
			paneId: "pane-1",
			tabId: "tab-1",
			nodeId: "node-1",
		});
	});

	it("prefers explicit nodeId over resolved", () => {
		const result = resolveNotificationTarget(
			{ paneId: "pane-1", nodeId: "explicit-node" },
			createState() as never,
		);
		expect(result?.nodeId).toBe("explicit-node");
	});

	it("prefers pane's tabId over explicit tabId", () => {
		const result = resolveNotificationTarget(
			{ paneId: "pane-1", tabId: "wrong-tab" },
			createState() as never,
		);
		expect(result?.tabId).toBe("tab-1");
	});

	it("uses explicit tabId when pane not found", () => {
		const result = resolveNotificationTarget({ tabId: "tab-2" }, createState() as never);
		expect(result?.tabId).toBe("tab-2");
		expect(result?.nodeId).toBe("node-2");
	});

	it("uses explicit tabId when paneId is undefined", () => {
		const result = resolveNotificationTarget({ tabId: "tab-1" }, createState() as never);
		expect(result?.tabId).toBe("tab-1");
		expect(result?.nodeId).toBe("node-1");
	});

	it("returns null if nodeId cannot be resolved", () => {
		const result = resolveNotificationTarget({ paneId: "unknown-pane" }, createState() as never);
		expect(result).toBeNull();
	});

	it("returns null if tabId not found and no nodeId", () => {
		const result = resolveNotificationTarget({ tabId: "unknown-tab" }, createState() as never);
		expect(result).toBeNull();
	});

	it("handles explicit nodeId without pane or tab", () => {
		const result = resolveNotificationTarget({ nodeId: "direct-node" }, createState() as never);
		expect(result).toEqual({
			paneId: undefined,
			tabId: undefined,
			nodeId: "direct-node",
		});
	});
});
