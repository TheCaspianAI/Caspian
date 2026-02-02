import type { BranchPrefixMode, TerminalLinkBehavior } from "lib/local-db";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "ui/components/ui/alert-dialog";
import { Button } from "ui/components/ui/button";
import { Input } from "ui/components/ui/input";
import { Kbd, KbdGroup } from "ui/components/ui/kbd";
import { Label } from "ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { toast } from "ui/components/ui/sonner";
import { Switch } from "ui/components/ui/switch";
import { cn } from "ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HiCheck, HiMagnifyingGlass, HiPlay, HiStop } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import {
	AVAILABLE_RINGTONES,
	type Ringtone,
	useSelectedRingtoneId,
	useSetRingtone,
} from "renderer/stores";
import {
	captureHotkeyFromEvent,
	getHotkeyConflict,
	useHotkeyDisplay,
	useHotkeysByCategory,
	useHotkeysStore,
} from "renderer/stores/hotkeys";
import {
	formatHotkeyText,
	HOTKEYS,
	type HotkeyCategory,
	type HotkeyId,
	type HotkeysState,
	isOsReservedHotkey,
	isTerminalReservedHotkey,
} from "shared/hotkeys";
import { resolveBranchPrefix, sanitizeSegment } from "shared/utils/branch";
import { BRANCH_PREFIX_MODE_LABELS } from "../../../utils/branch-prefix";

const CATEGORY_ORDER: HotkeyCategory[] = [
	"Workspace",
	"Terminal",
	"Layout",
	"Window",
	"Help",
];

// ============================================================================
// Notification Sounds Components
// ============================================================================

function formatDuration(seconds: number): string {
	return `${seconds}s`;
}

interface RingtoneCardProps {
	ringtone: Ringtone;
	isSelected: boolean;
	isPlaying: boolean;
	onSelect: () => void;
	onTogglePlay: () => void;
}

function RingtoneCard({
	ringtone,
	isSelected,
	isPlaying,
	onSelect,
	onTogglePlay,
}: RingtoneCardProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: Using div with role="button" to allow nested play/stop button
		<div
			role="button"
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			className={cn(
				"relative flex flex-col rounded-lg border-2 overflow-hidden transition-all text-left cursor-pointer",
				isSelected
					? "border-primary ring-2 ring-primary/20"
					: "border-border hover:border-muted-foreground/50",
			)}
		>
			{/* Preview area */}
			<div
				className={cn(
					"h-24 flex items-center justify-center relative",
					isSelected ? "bg-accent/50" : "bg-muted/30",
				)}
			>
				{/* Emoji */}
				<span className="text-4xl">{ringtone.emoji}</span>

				{/* Duration badge */}
				{ringtone.duration && (
					<span className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
						{formatDuration(ringtone.duration)}
					</span>
				)}

				{/* Play/Stop button */}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onTogglePlay();
					}}
					className={cn(
						"absolute bottom-2 right-2 h-8 w-8 rounded-full flex items-center justify-center",
						"transition-colors border",
						isPlaying
							? "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90"
							: "bg-card text-foreground border-border hover:bg-accent",
					)}
				>
					{isPlaying ? (
						<HiStop className="h-4 w-4" />
					) : (
						<HiPlay className="h-4 w-4 ml-0.5" />
					)}
				</button>
			</div>

			{/* Info */}
			<div className="p-3 bg-card border-t flex items-center justify-between">
				<div>
					<div className="text-sm font-medium">{ringtone.name}</div>
					<div className="text-xs text-muted-foreground">
						{ringtone.description}
					</div>
				</div>
				{isSelected && (
					<div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
						<HiCheck className="h-3 w-3 text-primary-foreground" />
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Keyboard Shortcuts Components
// ============================================================================

function HotkeyRow({
	id,
	label,
	description,
	isRecording,
	onStartRecording,
	onReset,
}: {
	id: HotkeyId;
	label: string;
	description?: string;
	isRecording: boolean;
	onStartRecording: () => void;
	onReset: () => void;
}) {
	const display = useHotkeyDisplay(id);

	return (
		<div className="flex items-center justify-between gap-4 py-3 px-4">
			<div className="flex flex-col">
				<span className="text-sm text-foreground">{label}</span>
				{description && (
					<span className="text-xs text-muted-foreground">{description}</span>
				)}
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onStartRecording}
					className="h-7 px-3 rounded-md border border-border bg-accent/20 text-xs text-foreground hover:bg-accent/40 transition-colors"
				>
					{isRecording ? (
						<span className="text-xs text-muted-foreground">Recording...</span>
					) : (
						<KbdGroup>
							{display.map((key) => (
								<Kbd key={key}>{key}</Kbd>
							))}
						</KbdGroup>
					)}
				</button>
				<Button variant="ghost" size="sm" onClick={onReset}>
					Reset
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Main PreferencesSettings Component
// ============================================================================

export function PreferencesSettings() {
	const utils = electronTrpc.useUtils();

	// ========================================================================
	// Notification Sounds State
	// ========================================================================
	const selectedRingtoneId = useSelectedRingtoneId();
	const setRingtone = useSetRingtone();
	const [playingId, setPlayingId] = useState<string | null>(null);
	const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data: isMutedData, isLoading: isMutedLoading } =
		electronTrpc.settings.getNotificationSoundsMuted.useQuery();
	const isMuted = isMutedData ?? false;

	const setMuted = electronTrpc.settings.setNotificationSoundsMuted.useMutation(
		{
			onMutate: async ({ muted }) => {
				await utils.settings.getNotificationSoundsMuted.cancel();
				const previous = utils.settings.getNotificationSoundsMuted.getData();
				utils.settings.getNotificationSoundsMuted.setData(undefined, muted);
				return { previous };
			},
			onError: (_err, _vars, context) => {
				if (context?.previous !== undefined) {
					utils.settings.getNotificationSoundsMuted.setData(
						undefined,
						context.previous,
					);
				}
			},
		},
	);

	const handleMutedToggle = (enabled: boolean) => {
		setMuted.mutate({ muted: !enabled });
	};

	// Clean up timer and stop any playing sound on unmount
	useEffect(() => {
		return () => {
			if (previewTimerRef.current) {
				clearTimeout(previewTimerRef.current);
			}
			// Stop any in-progress preview when navigating away
			electronTrpcClient.ringtone.stop.mutate().catch(() => {
				// Ignore errors during cleanup
			});
		};
	}, []);

	const handleTogglePlay = useCallback(
		async (ringtone: Ringtone) => {
			if (!ringtone.filename) {
				return;
			}

			// Clear any pending timer
			if (previewTimerRef.current) {
				clearTimeout(previewTimerRef.current);
				previewTimerRef.current = null;
			}

			// If this ringtone is already playing, stop it
			if (playingId === ringtone.id) {
				try {
					await electronTrpcClient.ringtone.stop.mutate();
				} catch (error) {
					console.error("Failed to stop ringtone:", error);
				}
				setPlayingId(null);
				return;
			}

			// Stop any currently playing sound first
			try {
				await electronTrpcClient.ringtone.stop.mutate();
			} catch (error) {
				console.error("Failed to stop ringtone:", error);
			}

			// Play the new sound
			setPlayingId(ringtone.id);

			try {
				await electronTrpcClient.ringtone.preview.mutate({
					filename: ringtone.filename,
				});
			} catch (error) {
				console.error("Failed to play ringtone:", error);
				setPlayingId(null);
			}

			// Auto-reset after the ringtone's actual duration (with 500ms buffer)
			const durationMs = ((ringtone.duration ?? 5) + 0.5) * 1000;
			previewTimerRef.current = setTimeout(() => {
				setPlayingId((current) => (current === ringtone.id ? null : current));
				previewTimerRef.current = null;
			}, durationMs);
		},
		[playingId],
	);

	const handleSelectRingtone = useCallback(
		(ringtoneId: string) => {
			setRingtone(ringtoneId);
		},
		[setRingtone],
	);

	// ========================================================================
	// Keyboard Shortcuts State
	// ========================================================================
	const [searchQuery, setSearchQuery] = useState("");
	const [recordingId, setRecordingId] = useState<HotkeyId | null>(null);
	const [pendingConflict, setPendingConflict] = useState<{
		id: HotkeyId;
		keys: string;
		conflictId: HotkeyId;
	} | null>(null);
	const [pendingImport, setPendingImport] = useState<{
		path: string;
		state: HotkeysState;
		summary: { assigned: number; disabled: number };
	} | null>(null);

	const platform = useHotkeysStore((state) => state.platform);
	const setHotkey = useHotkeysStore((state) => state.setHotkey);
	const setHotkeysBatch = useHotkeysStore((state) => state.setHotkeysBatch);
	const resetHotkey = useHotkeysStore((state) => state.resetHotkey);
	const resetAllHotkeys = useHotkeysStore((state) => state.resetAllHotkeys);
	const replaceHotkeysState = useHotkeysStore(
		(state) => state.replaceHotkeysState,
	);
	const hotkeysByCategory = useHotkeysByCategory();

	const exportMutation = electronTrpc.hotkeys.export.useMutation();
	const importMutation = electronTrpc.hotkeys.import.useMutation();

	const filteredHotkeysByCategory = useMemo(() => {
		if (!searchQuery) return hotkeysByCategory;
		const lower = searchQuery.toLowerCase();
		return Object.fromEntries(
			CATEGORY_ORDER.map((category) => [
				category,
				(hotkeysByCategory[category] ?? []).filter((hotkey) =>
					hotkey.label.toLowerCase().includes(lower),
				),
			]),
		) as typeof hotkeysByCategory;
	}, [hotkeysByCategory, searchQuery]);

	useEffect(() => {
		if (!recordingId) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();

			if (event.key === "Escape") {
				setRecordingId(null);
				return;
			}

			if (event.key === "Backspace" || event.key === "Delete") {
				setHotkey(recordingId, null);
				setRecordingId(null);
				return;
			}

			const captured = captureHotkeyFromEvent(event, platform);
			if (!captured) return;

			if (isTerminalReservedHotkey(captured)) {
				toast.error("That shortcut is reserved by the terminal.");
				setRecordingId(null);
				return;
			}

			const conflictId = getHotkeyConflict(captured, recordingId);
			if (conflictId) {
				setPendingConflict({ id: recordingId, keys: captured, conflictId });
				setRecordingId(null);
				return;
			}

			if (isOsReservedHotkey(captured, platform)) {
				toast.warning("This shortcut may be reserved by your OS.");
			}

			setHotkey(recordingId, captured);
			setRecordingId(null);
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => {
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
		};
	}, [recordingId, platform, setHotkey]);

	const handleStartRecording = (id: HotkeyId) => {
		setRecordingId((current) => (current === id ? null : id));
	};

	const handleExport = async () => {
		try {
			const result = await exportMutation.mutateAsync();
			if ("canceled" in result && result.canceled) return;
			if ("error" in result) {
				toast.error("Failed to export shortcuts", {
					description: result.error,
				});
				return;
			}
			toast.success("Keyboard shortcuts exported", {
				description: result.path,
			});
		} catch (error) {
			toast.error("Failed to export shortcuts", {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const handleImport = async () => {
		try {
			const result = await importMutation.mutateAsync();
			if ("canceled" in result && result.canceled) return;
			if ("error" in result) {
				toast.error("Failed to import shortcuts", {
					description: result.error,
				});
				return;
			}
			setPendingImport({
				path: result.path,
				state: result.state,
				summary: result.summary,
			});
		} catch (error) {
			toast.error("Failed to import shortcuts", {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const handleConfirmImport = () => {
		if (!pendingImport) return;
		replaceHotkeysState(pendingImport.state);
		toast.success("Keyboard shortcuts imported");
		setPendingImport(null);
	};

	const handleConflictReassign = () => {
		if (!pendingConflict) return;
		setHotkeysBatch({
			[pendingConflict.conflictId]: null,
			[pendingConflict.id]: pendingConflict.keys,
		});
		if (isOsReservedHotkey(pendingConflict.keys, platform)) {
			toast.warning("This shortcut may be reserved by your OS.");
		}
		setPendingConflict(null);
	};

	// ========================================================================
	// Application Behavior State
	// ========================================================================
	const { data: confirmOnQuit, isLoading: isConfirmLoading } =
		electronTrpc.settings.getConfirmOnQuit.useQuery();
	const setConfirmOnQuit = electronTrpc.settings.setConfirmOnQuit.useMutation({
		onMutate: async ({ enabled }) => {
			await utils.settings.getConfirmOnQuit.cancel();
			const previous = utils.settings.getConfirmOnQuit.getData();
			utils.settings.getConfirmOnQuit.setData(undefined, enabled);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous !== undefined) {
				utils.settings.getConfirmOnQuit.setData(undefined, context.previous);
			}
		},
		onSettled: () => {
			utils.settings.getConfirmOnQuit.invalidate();
		},
	});

	const handleConfirmToggle = (enabled: boolean) => {
		setConfirmOnQuit.mutate({ enabled });
	};

	const { data: branchPrefix, isLoading: isBranchPrefixLoading } =
		electronTrpc.settings.getBranchPrefix.useQuery();
	const { data: gitInfo } = electronTrpc.settings.getGitInfo.useQuery();

	const [customPrefixInput, setCustomPrefixInput] = useState(
		branchPrefix?.customPrefix ?? "",
	);

	useEffect(() => {
		setCustomPrefixInput(branchPrefix?.customPrefix ?? "");
	}, [branchPrefix?.customPrefix]);

	const setBranchPrefix = electronTrpc.settings.setBranchPrefix.useMutation({
		onError: (err) => {
			console.error("[settings/branch-prefix] Failed to update:", err);
		},
		onSettled: () => {
			utils.settings.getBranchPrefix.invalidate();
		},
	});

	const handleBranchPrefixModeChange = (mode: BranchPrefixMode) => {
		setBranchPrefix.mutate({
			mode,
			customPrefix: customPrefixInput || null,
		});
	};

	const handleCustomPrefixBlur = () => {
		const sanitized = sanitizeSegment(customPrefixInput);
		setCustomPrefixInput(sanitized);
		setBranchPrefix.mutate({
			mode: "custom",
			customPrefix: sanitized || null,
		});
	};

	const previewPrefix =
		resolveBranchPrefix({
			mode: branchPrefix?.mode ?? "none",
			customPrefix: customPrefixInput,
			authorPrefix: gitInfo?.authorPrefix,
			githubUsername: gitInfo?.githubUsername,
		}) ||
		(branchPrefix?.mode === "author"
			? "author-name"
			: branchPrefix?.mode === "github"
				? "username"
				: null);

	// ========================================================================
	// Link Behavior State
	// ========================================================================
	const { data: terminalLinkBehavior, isLoading: isLoadingLinkBehavior } =
		electronTrpc.settings.getTerminalLinkBehavior.useQuery();

	const setTerminalLinkBehavior =
		electronTrpc.settings.setTerminalLinkBehavior.useMutation({
			onMutate: async ({ behavior }) => {
				await utils.settings.getTerminalLinkBehavior.cancel();
				const previous = utils.settings.getTerminalLinkBehavior.getData();
				utils.settings.getTerminalLinkBehavior.setData(undefined, behavior);
				return { previous };
			},
			onError: (_err, _vars, context) => {
				if (context?.previous !== undefined) {
					utils.settings.getTerminalLinkBehavior.setData(
						undefined,
						context.previous,
					);
				}
			},
			onSettled: () => {
				utils.settings.getTerminalLinkBehavior.invalidate();
			},
		});

	const handleLinkBehaviorChange = (value: string) => {
		setTerminalLinkBehavior.mutate({
			behavior: value as TerminalLinkBehavior,
		});
	};

	// ========================================================================
	// Render
	// ========================================================================
	return (
		<div className="p-6 max-w-4xl w-full">
			<div className="space-y-10">
				{/* Page Header */}
				<div>
					<h2 className="text-lg font-semibold mb-1">Preferences</h2>
					<p className="text-sm text-muted-foreground">
						Configure application behavior and interaction settings
					</p>
				</div>

				{/* Notification Sounds Section */}
				<section className="space-y-4">
					<h3 className="text-sm font-medium">Notification Sounds</h3>

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="notification-sounds" className="text-sm font-medium">
								Enable notification sounds
							</Label>
							<p className="text-xs text-muted-foreground">
								Play a sound when tasks complete
							</p>
						</div>
						<Switch
							id="notification-sounds"
							checked={!isMuted}
							onCheckedChange={handleMutedToggle}
							disabled={isMutedLoading || setMuted.isPending}
						/>
					</div>

					{!isMuted && (
						<>
							<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
								{AVAILABLE_RINGTONES.map((ringtone) => (
									<RingtoneCard
										key={ringtone.id}
										ringtone={ringtone}
										isSelected={selectedRingtoneId === ringtone.id}
										isPlaying={playingId === ringtone.id}
										onSelect={() => handleSelectRingtone(ringtone.id)}
										onTogglePlay={() => handleTogglePlay(ringtone)}
									/>
								))}
							</div>

							<p className="text-xs text-muted-foreground pt-2">
								Click the play button to preview a sound. Click stop or play
								another to stop the current sound.
							</p>
						</>
					)}
				</section>

				{/* Keyboard Shortcuts Section */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium">Keyboard Shortcuts</h3>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleImport}>
								Import
							</Button>
							<Button variant="outline" size="sm" onClick={handleExport}>
								Export
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setRecordingId(null);
									resetAllHotkeys();
								}}
							>
								Reset all
							</Button>
						</div>
					</div>

					{/* Search */}
					<div className="relative">
						<HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							type="text"
							placeholder="Search shortcuts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9 bg-accent/30 border-transparent focus:border-accent"
						/>
					</div>

					{/* Tables by Category */}
					<div className="max-h-[400px] overflow-y-auto space-y-4">
						{CATEGORY_ORDER.map((category) => {
							const hotkeys = filteredHotkeysByCategory[category] ?? [];
							if (hotkeys.length === 0) return null;

							return (
								<div key={category}>
									<h4 className="text-xs font-medium text-muted-foreground mb-2">
										{category}
									</h4>
									<div className="rounded-lg border border-border overflow-hidden">
										<div className="flex items-center justify-between py-2 px-4 bg-accent/10 border-b border-border">
											<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
												Command
											</span>
											<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
												Shortcut
											</span>
										</div>
										<div className="divide-y divide-border">
											{hotkeys.map((hotkey) => (
												<HotkeyRow
													key={hotkey.id}
													id={hotkey.id}
													label={hotkey.label}
													description={hotkey.description}
													isRecording={recordingId === hotkey.id}
													onStartRecording={() => handleStartRecording(hotkey.id)}
													onReset={() => resetHotkey(hotkey.id)}
												/>
											))}
										</div>
									</div>
								</div>
							);
						})}

						{CATEGORY_ORDER.every(
							(cat) => (filteredHotkeysByCategory[cat] ?? []).length === 0,
						) && (
							<div className="py-8 text-center text-sm text-muted-foreground">
								No shortcuts found matching "{searchQuery}"
							</div>
						)}
					</div>
				</section>

				{/* Application Behavior Section */}
				<section className="space-y-4">
					<h3 className="text-sm font-medium">Application Behavior</h3>

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="confirm-on-quit" className="text-sm font-medium">
								Confirm before quitting
							</Label>
							<p className="text-xs text-muted-foreground">
								Show a confirmation dialog when quitting the application
							</p>
						</div>
						<Switch
							id="confirm-on-quit"
							checked={confirmOnQuit ?? true}
							onCheckedChange={handleConfirmToggle}
							disabled={isConfirmLoading || setConfirmOnQuit.isPending}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label className="text-sm font-medium">Branch prefix</Label>
							<p className="text-xs text-muted-foreground">
								Preview:{" "}
								<code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
									{previewPrefix ? `${previewPrefix}/branch-name` : "branch-name"}
								</code>
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Select
								value={branchPrefix?.mode ?? "none"}
								onValueChange={(value) =>
									handleBranchPrefixModeChange(value as BranchPrefixMode)
								}
								disabled={isBranchPrefixLoading || setBranchPrefix.isPending}
							>
								<SelectTrigger className="w-[180px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(
										Object.entries(BRANCH_PREFIX_MODE_LABELS) as [
											BranchPrefixMode,
											string,
										][]
									).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{branchPrefix?.mode === "custom" && (
								<Input
									placeholder="Prefix"
									value={customPrefixInput}
									onChange={(e) => setCustomPrefixInput(e.target.value)}
									onBlur={handleCustomPrefixBlur}
									className="w-[120px]"
									disabled={isBranchPrefixLoading || setBranchPrefix.isPending}
								/>
							)}
						</div>
					</div>
				</section>

				{/* Link Handling Section */}
				<section className="space-y-4">
					<h3 className="text-sm font-medium">Link Handling</h3>

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label
								htmlFor="terminal-link-behavior"
								className="text-sm font-medium"
							>
								Terminal file links
							</Label>
							<p className="text-xs text-muted-foreground">
								Choose how to open file paths when Cmd+clicking in the terminal
							</p>
						</div>
						<Select
							value={terminalLinkBehavior ?? "external-editor"}
							onValueChange={handleLinkBehaviorChange}
							disabled={
								isLoadingLinkBehavior || setTerminalLinkBehavior.isPending
							}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="external-editor">External editor</SelectItem>
								<SelectItem value="file-viewer">File viewer</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</section>
			</div>

			{/* Conflict dialog */}
			<AlertDialog
				open={!!pendingConflict}
				onOpenChange={() => setPendingConflict(null)}
			>
				<AlertDialogContent className="max-w-[380px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							Shortcut already in use
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{pendingConflict
										? `${formatHotkeyText(
												pendingConflict.keys,
												platform,
											)} is already assigned to "${
												HOTKEYS[pendingConflict.conflictId].label
											}".`
										: ""}
								</span>
								<span className="block">Would you like to reassign it?</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setPendingConflict(null)}
						>
							Cancel
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleConflictReassign}
						>
							Reassign
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Import dialog */}
			<AlertDialog
				open={!!pendingImport}
				onOpenChange={() => setPendingImport(null)}
			>
				<AlertDialogContent className="max-w-[420px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							Import keyboard shortcuts?
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									This will replace your shortcuts on all platforms.
								</span>
								{pendingImport && (
									<span className="block">
										{pendingImport.summary.assigned} assigned,{" "}
										{pendingImport.summary.disabled} disabled on {platform}.
									</span>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setPendingImport(null)}
						>
							Cancel
						</Button>
						<Button variant="secondary" size="sm" onClick={handleConfirmImport}>
							Import
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
