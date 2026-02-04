import { useCallback, useEffect, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { type PendingTerminalSetup, useNodeInitStore } from "renderer/stores/node-init";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { AddTabWithMultiplePanesOptions } from "renderer/stores/tabs/types";
import { DEFAULT_AUTO_APPLY_DEFAULT_PRESET } from "shared/constants";
import { toast } from "ui/components/ui/sonner";

/**
 * Handles terminal setup when nodes become ready.
 * Mounted at app root to survive dialog unmounts.
 */
export function NodeInitEffects() {
	const initProgress = useNodeInitStore((s) => s.initProgress);
	const pendingTerminalSetups = useNodeInitStore((s) => s.pendingTerminalSetups);
	const removePendingTerminalSetup = useNodeInitStore((s) => s.removePendingTerminalSetup);
	const clearProgress = useNodeInitStore((s) => s.clearProgress);

	const { data: autoApplyDefaultPreset } =
		electronTrpc.settings.getAutoApplyDefaultPreset.useQuery();
	const shouldApplyPreset = autoApplyDefaultPreset ?? DEFAULT_AUTO_APPLY_DEFAULT_PRESET;

	const processingRef = useRef<Set<string>>(new Set());

	const addTab = useTabsStore((state) => state.addTab);
	const addPane = useTabsStore((state) => state.addPane);
	const addPanesToTab = useTabsStore((state) => state.addPanesToTab);
	const addTabWithMultiplePanes = useTabsStore((state) => state.addTabWithMultiplePanes);
	const setTabAutoTitle = useTabsStore((state) => state.setTabAutoTitle);
	const renameTab = useTabsStore((state) => state.renameTab);
	const createOrAttach = electronTrpc.terminal.createOrAttach.useMutation();
	const utils = electronTrpc.useUtils();

	const createPresetTerminal = useCallback(
		(
			nodeId: string,
			preset: NonNullable<PendingTerminalSetup["defaultPreset"]>,
			existingTabId?: string,
		) => {
			const isParallel = preset.executionMode === "parallel" && preset.commands.length > 1;

			if (existingTabId) {
				if (isParallel) {
					addPanesToTab(existingTabId, {
						commands: preset.commands,
						initialCwd: preset.cwd || undefined,
					});
				} else {
					addPane(existingTabId, {
						initialCommands: preset.commands,
						initialCwd: preset.cwd || undefined,
					});
				}
				return;
			}

			if (isParallel) {
				const options: AddTabWithMultiplePanesOptions = {
					commands: preset.commands,
					initialCwd: preset.cwd || undefined,
				};
				const { tabId } = addTabWithMultiplePanes(nodeId, options);
				renameTab(tabId, preset.name);
			} else {
				const { tabId } = addTab(nodeId, {
					initialCommands: preset.commands,
					initialCwd: preset.cwd || undefined,
				});
				renameTab(tabId, preset.name);
			}
		},
		[addTab, addPane, addPanesToTab, addTabWithMultiplePanes, renameTab],
	);

	const handleTerminalSetup = useCallback(
		(setup: PendingTerminalSetup, onComplete: () => void) => {
			const hasSetupScript =
				Array.isArray(setup.initialCommands) && setup.initialCommands.length > 0;
			const hasDefaultPreset =
				shouldApplyPreset && setup.defaultPreset != null && setup.defaultPreset.commands.length > 0;

			if (hasSetupScript && hasDefaultPreset && setup.defaultPreset) {
				const { tabId: setupTabId, paneId: setupPaneId } = addTab(setup.nodeId);
				setTabAutoTitle(setupTabId, "Node Setup");
				createPresetTerminal(setup.nodeId, setup.defaultPreset, setupTabId);

				createOrAttach.mutate(
					{
						paneId: setupPaneId,
						tabId: setupTabId,
						nodeId: setup.nodeId,
						initialCommands: setup.initialCommands ?? undefined,
					},
					{
						onSuccess: () => onComplete(),
						onError: (error) => {
							console.error("[NodeInitEffects] Failed to create terminal:", error);
							toast.error("Failed to create terminal", {
								description: error.message || "Terminal setup failed. Please try again.",
							});
							onComplete();
						},
					},
				);
				return;
			}

			if (hasSetupScript) {
				const { tabId, paneId } = addTab(setup.nodeId);
				setTabAutoTitle(tabId, "Node Setup");
				createOrAttach.mutate(
					{
						paneId,
						tabId,
						nodeId: setup.nodeId,
						initialCommands: setup.initialCommands ?? undefined,
					},
					{
						onSuccess: () => onComplete(),
						onError: (error) => {
							console.error("[NodeInitEffects] Failed to create terminal:", error);
							toast.error("Failed to create terminal", {
								description: error.message || "Terminal setup failed. Please try again.",
								action: {
									label: "Open Terminal",
									onClick: () => {
										const { tabId: newTabId, paneId: newPaneId } = addTab(setup.nodeId);
										createOrAttach.mutate({
											paneId: newPaneId,
											tabId: newTabId,
											nodeId: setup.nodeId,
											initialCommands: setup.initialCommands ?? undefined,
										});
									},
								},
							});
							onComplete();
						},
					},
				);
				return;
			}

			if (shouldApplyPreset && setup.defaultPreset && setup.defaultPreset.commands.length > 0) {
				createPresetTerminal(setup.nodeId, setup.defaultPreset);
				onComplete();
				return;
			}

			// No setup script and no default preset - that's fine, user can configure
			// scripts during node creation in Advanced Options if they want
			onComplete();
		},
		[addTab, setTabAutoTitle, createOrAttach, createPresetTerminal, shouldApplyPreset],
	);

	useEffect(() => {
		for (const [nodeId, setup] of Object.entries(pendingTerminalSetups)) {
			const progress = initProgress[nodeId];

			if (processingRef.current.has(nodeId)) {
				continue;
			}

			if (progress?.step === "ready") {
				processingRef.current.add(nodeId);

				// Always fetch from backend to ensure we have the latest preset
				// (client-side preset query may not have resolved when pending setup was created)
				if (setup.defaultPreset === undefined) {
					utils.nodes.getSetupCommands
						.fetch({ nodeId })
						.then((setupData) => {
							const completeSetup: PendingTerminalSetup = {
								...setup,
								defaultPreset: setupData?.defaultPreset ?? null,
							};
							handleTerminalSetup(completeSetup, () => {
								removePendingTerminalSetup(nodeId);
								clearProgress(nodeId);
								processingRef.current.delete(nodeId);
							});
						})
						.catch((error) => {
							console.error("[NodeInitEffects] Failed to fetch setup commands:", error);
							handleTerminalSetup(setup, () => {
								removePendingTerminalSetup(nodeId);
								clearProgress(nodeId);
								processingRef.current.delete(nodeId);
							});
						});
				} else {
					handleTerminalSetup(setup, () => {
						removePendingTerminalSetup(nodeId);
						clearProgress(nodeId);
						processingRef.current.delete(nodeId);
					});
				}
			}

			if (progress?.step === "failed") {
				removePendingTerminalSetup(nodeId);
			}
		}

		// Handle nodes that became ready without pending setup data (after retry or app restart)
		for (const [nodeId, progress] of Object.entries(initProgress)) {
			if (progress.step !== "ready") {
				continue;
			}
			if (pendingTerminalSetups[nodeId]) {
				continue;
			}
			if (processingRef.current.has(nodeId)) {
				continue;
			}

			processingRef.current.add(nodeId);

			utils.nodes.getSetupCommands
				.fetch({ nodeId })
				.then((setupData) => {
					if (!setupData) {
						clearProgress(nodeId);
						processingRef.current.delete(nodeId);
						return;
					}

					const fetchedSetup: PendingTerminalSetup = {
						nodeId,
						repositoryId: setupData.repositoryId,
						initialCommands: setupData.initialCommands,
						defaultPreset: setupData.defaultPreset,
					};

					handleTerminalSetup(fetchedSetup, () => {
						clearProgress(nodeId);
						processingRef.current.delete(nodeId);
					});
				})
				.catch((error) => {
					console.error("[NodeInitEffects] Failed to fetch setup commands:", error);
					clearProgress(nodeId);
					processingRef.current.delete(nodeId);
				});
		}
	}, [
		initProgress,
		pendingTerminalSetups,
		removePendingTerminalSetup,
		clearProgress,
		handleTerminalSetup,
		utils.nodes.getSetupCommands,
	]);

	return null;
}
