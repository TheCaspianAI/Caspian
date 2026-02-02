import { toast } from "ui/components/ui/sonner";
import { useEffect, useMemo, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { usePortsStore } from "renderer/stores";
import type { MergedPort } from "shared/types";
import { mergePorts } from "../utils";

export interface MergedNodeGroup {
	nodeId: string;
	nodeName: string;
	ports: MergedPort[];
}

export function usePortsData() {
	const { data: allNodes } = electronTrpc.nodes.getAll.useQuery();
	const ports = usePortsStore((s) => s.ports);
	const setPorts = usePortsStore((s) => s.setPorts);
	const addPort = usePortsStore((s) => s.addPort);
	const removePort = usePortsStore((s) => s.removePort);

	const utils = electronTrpc.useUtils();

	const { data: allStaticPortsData } =
		electronTrpc.ports.getAllStatic.useQuery();

	// Subscribe to all static port changes
	electronTrpc.ports.subscribeStatic.useSubscription(
		{ nodeId: "" },
		{
			onData: () => {
				utils.ports.getAllStatic.invalidate();
			},
		},
	);

	const { data: initialPorts } = electronTrpc.ports.getAll.useQuery();

	useEffect(() => {
		if (initialPorts) {
			setPorts(initialPorts);
		}
	}, [initialPorts, setPorts]);

	electronTrpc.ports.subscribe.useSubscription(undefined, {
		onData: (event) => {
			if (event.type === "add") {
				addPort(event.port);
			} else if (event.type === "remove") {
				removePort(event.port.paneId, event.port.port);
			}
		},
	});

	const nodeNames = useMemo(() => {
		if (!allNodes) return {};
		return allNodes.reduce(
			(acc, ws) => {
				acc[ws.id] = ws.name;
				return acc;
			},
			{} as Record<string, string>,
		);
	}, [allNodes]);

	// Prevent showing duplicate error toasts on re-renders
	const shownErrorsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const errors = allStaticPortsData?.errors ?? [];
		for (const { nodeId, error } of errors) {
			const errorKey = `${nodeId}:${error}`;
			if (!shownErrorsRef.current.has(errorKey)) {
				shownErrorsRef.current.add(errorKey);
				const nodeName =
					nodeNames[nodeId] || "Unknown node";
				toast.error(`Failed to load ports.json in ${nodeName}`, {
					description: error,
				});
			}
		}
	}, [allStaticPortsData?.errors, nodeNames]);

	const allNodeIds = useMemo(() => {
		const ids = new Set<string>();

		for (const port of allStaticPortsData?.ports ?? []) {
			ids.add(port.nodeId);
		}

		for (const port of ports) {
			ids.add(port.nodeId);
		}

		return Array.from(ids);
	}, [allStaticPortsData?.ports, ports]);

	const nodePortGroups = useMemo(() => {
		const allStaticPorts = allStaticPortsData?.ports ?? [];

		const groups: MergedNodeGroup[] = allNodeIds.map(
			(nodeId) => {
				const staticPortsForNode = allStaticPorts.filter(
					(p) => p.nodeId === nodeId,
				);

				const merged = mergePorts({
					staticPorts: staticPortsForNode,
					dynamicPorts: ports,
					nodeId,
				});

				return {
					nodeId,
					nodeName: nodeNames[nodeId] || "Unknown",
					ports: merged,
				};
			},
		);

		// Sort alphabetically by node name
		groups.sort((a, b) => a.nodeName.localeCompare(b.nodeName));

		return groups;
	}, [allNodeIds, allStaticPortsData?.ports, ports, nodeNames]);

	const totalPortCount = nodePortGroups.reduce(
		(sum, g) => sum + g.ports.length,
		0,
	);

	return {
		nodePortGroups,
		totalPortCount,
	};
}
