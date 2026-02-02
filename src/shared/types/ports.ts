export interface DetectedPort {
	port: number;
	pid: number;
	processName: string;
	paneId: string;
	nodeId: string;
	detectedAt: number;
	address: string;
}

export interface StaticPort {
	port: number;
	label: string;
	nodeId: string;
}

export interface StaticPortsResult {
	exists: boolean;
	ports: Omit<StaticPort, "nodeId">[] | null;
	error: string | null;
}

export interface MergedPort {
	port: number;
	nodeId: string;
	label: string | null;
	isActive: boolean;
	pid: number | null;
	processName: string | null;
	paneId: string | null;
	address: string | null;
	detectedAt: number | null;
}
