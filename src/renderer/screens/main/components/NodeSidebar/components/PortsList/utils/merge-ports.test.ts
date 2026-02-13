import { describe, expect, it } from "bun:test";
import type { DetectedPort, StaticPort } from "shared/types";
import { mergePorts } from "./merge-ports";

const NODE_ID = "node-1";
const OTHER_NODE_ID = "node-2";

function makeStaticPort(overrides: Partial<StaticPort> & { port: number }): StaticPort {
	return { nodeId: NODE_ID, label: `Port ${overrides.port}`, ...overrides };
}

function makeDetectedPort(overrides: Partial<DetectedPort> & { port: number }): DetectedPort {
	return {
		nodeId: NODE_ID,
		pid: 1234,
		processName: "node",
		paneId: "pane-1",
		address: "127.0.0.1",
		detectedAt: 1000,
		...overrides,
	};
}

describe("mergePorts", () => {
	it("returns empty array when both inputs are empty", () => {
		const result = mergePorts({ staticPorts: [], dynamicPorts: [], nodeId: NODE_ID });
		expect(result).toEqual([]);
	});

	it("returns inactive static ports when no dynamic ports match", () => {
		const result = mergePorts({
			staticPorts: [makeStaticPort({ port: 3000 })],
			dynamicPorts: [],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			port: 3000,
			nodeId: NODE_ID,
			label: "Port 3000",
			isActive: false,
			pid: null,
			processName: null,
			paneId: null,
			address: null,
			detectedAt: null,
		});
	});

	it("merges dynamic port info into matching static port", () => {
		const result = mergePorts({
			staticPorts: [makeStaticPort({ port: 3000 })],
			dynamicPorts: [makeDetectedPort({ port: 3000, pid: 5678, processName: "vite" })],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(1);
		expect(result[0].isActive).toBe(true);
		expect(result[0].label).toBe("Port 3000");
		expect(result[0].pid).toBe(5678);
		expect(result[0].processName).toBe("vite");
	});

	it("adds dynamic-only ports not in static config", () => {
		const result = mergePorts({
			staticPorts: [makeStaticPort({ port: 3000 })],
			dynamicPorts: [makeDetectedPort({ port: 8080, processName: "express" })],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(2);

		const dynamicOnly = result.find((p) => p.port === 8080);
		expect(dynamicOnly).toBeDefined();
		expect(dynamicOnly!.label).toBeNull();
		expect(dynamicOnly!.isActive).toBe(true);
		expect(dynamicOnly!.processName).toBe("express");
	});

	it("filters dynamic ports to the specified nodeId", () => {
		const result = mergePorts({
			staticPorts: [],
			dynamicPorts: [
				makeDetectedPort({ port: 3000, nodeId: NODE_ID }),
				makeDetectedPort({ port: 4000, nodeId: OTHER_NODE_ID }),
			],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(1);
		expect(result[0].port).toBe(3000);
	});

	it("sorts results by port number ascending", () => {
		const result = mergePorts({
			staticPorts: [makeStaticPort({ port: 8080 }), makeStaticPort({ port: 3000 })],
			dynamicPorts: [makeDetectedPort({ port: 5000 })],
			nodeId: NODE_ID,
		});

		expect(result.map((p) => p.port)).toEqual([3000, 5000, 8080]);
	});

	it("does not duplicate a dynamic port that matches a static port", () => {
		const result = mergePorts({
			staticPorts: [makeStaticPort({ port: 3000 })],
			dynamicPorts: [makeDetectedPort({ port: 3000 })],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(1);
		expect(result[0].port).toBe(3000);
	});

	it("handles multiple static and dynamic ports together", () => {
		const result = mergePorts({
			staticPorts: [
				makeStaticPort({ port: 3000, label: "Dev" }),
				makeStaticPort({ port: 5432, label: "DB" }),
			],
			dynamicPorts: [
				makeDetectedPort({ port: 3000, processName: "vite" }),
				makeDetectedPort({ port: 9229, processName: "node --inspect" }),
			],
			nodeId: NODE_ID,
		});

		expect(result).toHaveLength(3);
		expect(result[0]).toMatchObject({ port: 3000, label: "Dev", isActive: true });
		expect(result[1]).toMatchObject({ port: 5432, label: "DB", isActive: false });
		expect(result[2]).toMatchObject({ port: 9229, label: null, isActive: true });
	});
});
