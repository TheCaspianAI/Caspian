import { useEffect, useMemo, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { usePortsStore } from "renderer/stores/ports";
import type { MergedPort } from "shared/types";
import { toast } from "ui/components/ui/sonner";
import { mergePorts } from "../utils/merge-ports";

export interface NodePortGroup {
	nodeId: string;
	nodeName: string;
	ports: MergedPort[];
}

export function usePortsData() {
	const { data: groups = [] } = electronTrpc.nodes.getAllGrouped.useQuery();
	const ports = usePortsStore((s) => s.ports);
	const setPorts = usePortsStore((s) => s.setPorts);
	const addPort = usePortsStore((s) => s.addPort);
	const removePort = usePortsStore((s) => s.removePort);

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

	const { data: allStaticPortsData } = electronTrpc.ports.getAllStatic.useQuery(undefined, {
		refetchInterval: 10_000,
	});

	const nodeNames = useMemo(() => {
		const map: Record<string, string> = {};
		for (const group of groups) {
			for (const node of group.nodes) {
				map[node.id] = node.name;
			}
		}
		return map;
	}, [groups]);

	const shownErrorsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const errors = allStaticPortsData?.errors ?? [];
		for (const { nodeId, error } of errors) {
			const errorKey = `${nodeId}:${error}`;
			if (!shownErrorsRef.current.has(errorKey)) {
				shownErrorsRef.current.add(errorKey);
				const nodeName = nodeNames[nodeId] || "Unknown node";
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

		const result: NodePortGroup[] = allNodeIds.map((nodeId) => {
			const staticPortsForNode = allStaticPorts.filter((p) => p.nodeId === nodeId);
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
		});

		result.sort((a, b) => a.nodeName.localeCompare(b.nodeName));
		return result;
	}, [allNodeIds, allStaticPortsData?.ports, ports, nodeNames]);

	const totalPortCount = nodePortGroups.reduce((sum, g) => sum + g.ports.length, 0);

	return { nodePortGroups, totalPortCount };
}
