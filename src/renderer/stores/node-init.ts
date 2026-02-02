import type { TerminalPreset } from "lib/local-db";
import type { NodeInitProgress } from "shared/types/node-init";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface PendingTerminalSetup {
	nodeId: string;
	repositoryId: string;
	initialCommands: string[] | null;
	defaultPreset?: TerminalPreset | null;
}

interface NodeInitState {
	initProgress: Record<string, NodeInitProgress>;
	pendingTerminalSetups: Record<string, PendingTerminalSetup>;
	updateProgress: (progress: NodeInitProgress) => void;
	clearProgress: (nodeId: string) => void;
	addPendingTerminalSetup: (setup: PendingTerminalSetup) => void;
	removePendingTerminalSetup: (nodeId: string) => void;
}

export const useNodeInitStore = create<NodeInitState>()(
	devtools(
		(set, get) => ({
			initProgress: {},
			pendingTerminalSetups: {},

			updateProgress: (progress) => {
				set((state) => ({
					initProgress: {
						...state.initProgress,
						[progress.nodeId]: progress,
					},
				}));

				if (progress.step === "ready") {
					setTimeout(
						() => {
							const current = get().initProgress[progress.nodeId];
							if (current?.step === "ready") {
								get().clearProgress(progress.nodeId);
							}
						},
						5 * 60 * 1000,
					); // 5 minutes
				}
			},

			clearProgress: (nodeId) => {
				set((state) => {
					const { [nodeId]: _, ...rest } = state.initProgress;
					return { initProgress: rest };
				});
			},

			addPendingTerminalSetup: (setup) => {
				set((state) => ({
					pendingTerminalSetups: {
						...state.pendingTerminalSetups,
						[setup.nodeId]: setup,
					},
				}));
			},

			removePendingTerminalSetup: (nodeId) => {
				set((state) => {
					const { [nodeId]: _, ...rest } = state.pendingTerminalSetups;
					return { pendingTerminalSetups: rest };
				});
			},
		}),
		{ name: "NodeInitStore" },
	),
);

export const useNodeInitProgress = (nodeId: string) =>
	useNodeInitStore((state) => state.initProgress[nodeId]);

export const useIsNodeInitializing = (nodeId: string) =>
	useNodeInitStore((state) => {
		const progress = state.initProgress[nodeId];
		return (
			progress !== undefined &&
			progress.step !== "ready" &&
			progress.step !== "failed"
		);
	});

export const useHasNodeFailed = (nodeId: string) =>
	useNodeInitStore((state) => {
		const progress = state.initProgress[nodeId];
		return progress?.step === "failed";
	});
