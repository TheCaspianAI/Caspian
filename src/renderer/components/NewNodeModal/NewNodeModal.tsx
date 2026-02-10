import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GoGitBranch } from "react-icons/go";
import { HiCheck, HiChevronDown, HiChevronUpDown } from "react-icons/hi2";
import { LuFolderOpen } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { useCreateNode } from "renderer/react-query/nodes";
import { useOpenNew } from "renderer/react-query/repositories";
import {
	useCloseNewNodeModal,
	useNewNodeModalOpen,
	usePreSelectedRepositoryId,
} from "renderer/stores/new-node-modal";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { resolveBranchPrefix, sanitizeBranchName, sanitizeSegment } from "shared/utils/branch";
import { Button } from "ui/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "ui/components/ui/collapsible";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "ui/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "ui/components/ui/dropdown-menu";
import { Input } from "ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "ui/components/ui/popover";
import { toast } from "ui/components/ui/sonner";
import { Textarea } from "ui/components/ui/textarea";
import { ExistingWorktreesList } from "./components/ExistingWorktreesList";

function generateSlugFromTitle(title: string): string {
	return sanitizeSegment(title);
}

type Mode = "existing" | "new" | "cloud";

/**
 * Modal dialog for creating a new node or opening an existing worktree.
 */
export function NewNodeModal() {
	const isOpen = useNewNodeModalOpen();
	const closeModal = useCloseNewNodeModal();
	const preSelectedRepositoryId = usePreSelectedRepositoryId();
	const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [branchName, setBranchName] = useState("");
	const [branchNameEdited, setBranchNameEdited] = useState(false);
	const [mode, setMode] = useState<Mode>("new");
	const [baseBranch, setBaseBranch] = useState<string | null>(null);
	const [baseBranchOpen, setBaseBranchOpen] = useState(false);
	const [branchSearch, setBranchSearch] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [setupScript, setSetupScript] = useState("");
	const [teardownScript, setTeardownScript] = useState("");
	const titleInputRef = useRef<HTMLInputElement>(null);

	const { data: recentRepositories = [] } = electronTrpc.repositories.getRecents.useQuery();
	const { data: repository } = electronTrpc.repositories.get.useQuery(
		{ id: selectedRepositoryId ?? "" },
		{ enabled: !!selectedRepositoryId },
	);
	const {
		data: branchData,
		isLoading: isBranchesLoading,
		isError: isBranchesError,
	} = electronTrpc.repositories.getBranches.useQuery(
		{ repositoryId: selectedRepositoryId ?? "" },
		{ enabled: !!selectedRepositoryId },
	);
	const { data: gitAuthor } = electronTrpc.repositories.getGitAuthor.useQuery(
		{ id: selectedRepositoryId ?? "" },
		{ enabled: !!selectedRepositoryId },
	);
	const { data: globalBranchPrefix } = electronTrpc.settings.getBranchPrefix.useQuery();
	const { data: gitInfo } = electronTrpc.settings.getGitInfo.useQuery();
	const createNode = useCreateNode();
	const openNew = useOpenNew();
	const navigate = useNavigate();

	const resolvedPrefix = useMemo(() => {
		const repositoryOverrides = repository?.branchPrefixMode != null;
		return resolveBranchPrefix({
			mode: repositoryOverrides
				? repository?.branchPrefixMode
				: (globalBranchPrefix?.mode ?? "none"),
			customPrefix: repositoryOverrides
				? repository?.branchPrefixCustom
				: globalBranchPrefix?.customPrefix,
			authorPrefix: gitAuthor?.prefix,
			githubUsername: gitInfo?.githubUsername,
		});
	}, [repository, globalBranchPrefix, gitAuthor, gitInfo]);

	const filteredBranches = useMemo(() => {
		if (!branchData?.branches) return [];
		if (!branchSearch) return branchData.branches;
		const searchLower = branchSearch.toLowerCase();
		return branchData.branches.filter((b) => b.name.toLowerCase().includes(searchLower));
	}, [branchData?.branches, branchSearch]);

	useEffect(() => {
		if (isOpen && !selectedRepositoryId && preSelectedRepositoryId) {
			setSelectedRepositoryId(preSelectedRepositoryId);
		}
	}, [isOpen, selectedRepositoryId, preSelectedRepositoryId]);

	const effectiveBaseBranch = baseBranch ?? branchData?.defaultBranch ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when repository changes
	useEffect(() => {
		setBaseBranch(null);
	}, [selectedRepositoryId]);

	const branchSlug = branchNameEdited
		? sanitizeBranchName(branchName)
		: generateSlugFromTitle(title);

	const applyPrefix = !branchNameEdited;

	const branchPreview =
		branchSlug && applyPrefix && resolvedPrefix ? `${resolvedPrefix}/${branchSlug}` : branchSlug;

	const branchCollision = useMemo(() => {
		if (!branchData?.branches || !branchPreview) return null;

		const matchingBranch = branchData.branches.find((b) => b.name === branchPreview);
		if (!matchingBranch) return null;

		const existingNode = branchData.branchNodes?.[branchPreview];
		if (existingNode) {
			return {
				type: "has-node" as const,
				branchName: branchPreview,
				nodeId: existingNode.nodeId,
				nodeName: existingNode.nodeName,
			};
		}

		return {
			type: "branch-exists" as const,
			branchName: branchPreview,
		};
	}, [branchPreview, branchData]);

	const resetForm = () => {
		setSelectedRepositoryId(null);
		setTitle("");
		setBranchName("");
		setBranchNameEdited(false);
		setMode("new");
		setBaseBranch(null);
		setBranchSearch("");
		setShowAdvanced(false);
		setSetupScript("");
		setTeardownScript("");
	};

	useEffect(() => {
		if (isOpen && selectedRepositoryId && mode === "new") {
			const timer = setTimeout(() => titleInputRef.current?.focus(), 50);
			return () => clearTimeout(timer);
		}
	}, [isOpen, selectedRepositoryId, mode]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (
			e.key === "Enter" &&
			!e.shiftKey &&
			mode === "new" &&
			selectedRepositoryId &&
			!createNode.isPending
		) {
			e.preventDefault();
			handleCreateNode();
		}
	};

	const handleClose = () => {
		closeModal();
		resetForm();
	};

	const handleBranchNameChange = (value: string) => {
		setBranchName(value);
		setBranchNameEdited(true);
	};

	const handleBranchNameBlur = () => {
		if (!branchName.trim()) {
			setBranchName("");
			setBranchNameEdited(false);
		}
	};

	const handleImportRepo = async () => {
		try {
			const result = await openNew.mutateAsync(undefined);
			if (result.canceled) return;
			if ("error" in result) {
				toast.error("Failed to open repository", { description: result.error });
				return;
			}
			if ("needsGitInit" in result) {
				toast.error("Selected folder is not a git repository");
				return;
			}
			setSelectedRepositoryId(result.repository.id);
		} catch (error) {
			toast.error("Failed to open repository", {
				description: error instanceof Error ? error.message : "An unknown error occurred",
			});
		}
	};

	const selectedRepository = recentRepositories.find((r) => r.id === selectedRepositoryId);

	const handleCreateNode = async (options?: { useExistingBranch?: boolean }) => {
		if (!selectedRepositoryId) return;

		const nodeName = title.trim() || undefined;
		const useExisting = options?.useExistingBranch ?? false;

		try {
			const result = await createNode.mutateAsync({
				repositoryId: selectedRepositoryId,
				name: nodeName,
				branchName: useExisting ? branchPreview : (branchSlug || undefined),
				baseBranch: effectiveBaseBranch || undefined,
				applyPrefix: useExisting ? false : applyPrefix,
				useExistingBranch: useExisting,
				setupScript: setupScript.trim() || undefined,
				teardownScript: teardownScript.trim() || undefined,
			});

			handleClose();

			if (result.isInitializing) {
				toast.success("Node created", {
					description: "Setting up in the background...",
				});
			} else {
				toast.success("Node created");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create node");
		}
	};

	return (
		<Dialog modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent
				className="sm:max-w-[440px] gap-0 p-0 overflow-hidden"
				onKeyDown={handleKeyDown}
			>
				<DialogHeader className="px-4 pt-4 pb-3">
					<DialogTitle className="text-base">Open Node</DialogTitle>
				</DialogHeader>

				<div className="px-4 pb-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="w-full h-8 text-sm justify-between font-normal">
								<span className={selectedRepository ? "" : "text-muted-foreground"}>
									{selectedRepository?.name ?? "Select repository"}
								</span>
								<HiChevronDown className="size-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
							{recentRepositories
								.filter((repository) => repository.id)
								.map((repository) => (
									<DropdownMenuItem
										key={repository.id}
										onClick={() => setSelectedRepositoryId(repository.id)}
									>
										{repository.name}
										{repository.id === selectedRepositoryId && (
											<HiCheck className="ml-auto size-4" />
										)}
									</DropdownMenuItem>
								))}
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleImportRepo}>
								<LuFolderOpen className="size-4" />
								Import repository
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{selectedRepositoryId && (
					<>
						<div className="px-4 pb-3">
							<div className="flex p-0.5 bg-muted rounded-md">
								<button
									type="button"
									onClick={() => setMode("new")}
									className={`flex-1 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
										mode === "new"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									New
								</button>
								<button
									type="button"
									onClick={() => setMode("existing")}
									className={`flex-1 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
										mode === "existing"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Existing
								</button>
								<button
									type="button"
									onClick={() => setMode("cloud")}
									className={`flex-1 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
										mode === "cloud"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Cloud
								</button>
							</div>
						</div>

						<div className="px-4 pb-4">
							{mode === "new" && (
								<div className="space-y-3">
									<Input
										ref={titleInputRef}
										id="title"
										className="h-9 text-sm"
										placeholder="Feature name (press Enter to create)"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
									/>

									{(title || branchNameEdited) && (
										<p className="text-xs text-muted-foreground flex items-center gap-1.5">
											<GoGitBranch className="size-3" />
											<span className="font-mono">{branchPreview || "branch-name"}</span>
											<span className="text-muted-foreground/60">from {effectiveBaseBranch}</span>
										</p>
									)}

									{branchCollision && (
										<div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs">
											{branchCollision.type === "has-node" ? (
												<>
													<span className="text-amber-700 dark:text-amber-300 flex-1">
														Branch{" "}
														<span className="font-mono font-medium">
															{branchCollision.branchName}
														</span>{" "}
														is already open as &ldquo;{branchCollision.nodeName}&rdquo;
													</span>
													<button
														type="button"
														className="shrink-0 text-amber-700 dark:text-amber-300 underline hover:no-underline"
														onClick={() => {
															navigateToNode(branchCollision.nodeId, navigate);
															handleClose();
														}}
													>
														Go to node
													</button>
												</>
											) : (
												<>
													<span className="text-amber-700 dark:text-amber-300 flex-1">
														Branch{" "}
														<span className="font-mono font-medium">
															{branchCollision.branchName}
														</span>{" "}
														already exists
													</span>
													<button
														type="button"
														className="shrink-0 text-amber-700 dark:text-amber-300 underline hover:no-underline"
														onClick={() => handleCreateNode({ useExistingBranch: true })}
													>
														Use existing branch
													</button>
												</>
											)}
										</div>
									)}

									<Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
										<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
											<HiChevronDown
												className={`size-3 transition-transform ${showAdvanced ? "" : "-rotate-90"}`}
											/>
											Advanced options
										</CollapsibleTrigger>
										<CollapsibleContent className="pt-3 space-y-3">
											<div className="space-y-1.5">
												<label htmlFor="branch" className="text-xs text-muted-foreground">
													Branch name
												</label>
												<Input
													id="branch"
													className="h-8 text-sm font-mono"
													placeholder="auto-generated"
													value={branchNameEdited ? branchName : branchPreview}
													onChange={(e) => handleBranchNameChange(e.target.value)}
													onBlur={handleBranchNameBlur}
												/>
											</div>

											<div className="space-y-1.5">
												<span className="text-xs text-muted-foreground">Base branch</span>
												{isBranchesError ? (
													<div className="flex items-center gap-2 h-8 px-3 rounded-md border border-destructive/50 bg-destructive/10 text-destructive text-xs">
														Failed to load branches
													</div>
												) : (
													<Popover
														open={baseBranchOpen}
														onOpenChange={setBaseBranchOpen}
														modal={false}
													>
														<PopoverTrigger asChild>
															<Button
																variant="outline"
																size="sm"
																className="w-full h-8 justify-between font-normal"
																disabled={isBranchesLoading}
															>
																<span className="flex items-center gap-2 truncate">
																	<GoGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
																	<span className="truncate font-mono text-sm">
																		{effectiveBaseBranch || "Select branch..."}
																	</span>
																	{effectiveBaseBranch === branchData?.defaultBranch && (
																		<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
																			default
																		</span>
																	)}
																</span>
																<HiChevronUpDown className="size-4 shrink-0 text-muted-foreground" />
															</Button>
														</PopoverTrigger>
														<PopoverContent
															className="w-[--radix-popover-trigger-width] p-0"
															align="start"
															onWheel={(e) => e.stopPropagation()}
														>
															<Command shouldFilter={false}>
																<CommandInput
																	placeholder="Search branches..."
																	value={branchSearch}
																	onValueChange={setBranchSearch}
																/>
																<CommandList className="max-h-[200px]">
																	<CommandEmpty>No branches found</CommandEmpty>
																	{filteredBranches.map((branch) => (
																		<CommandItem
																			key={branch.name}
																			value={branch.name}
																			onSelect={() => {
																				setBaseBranch(branch.name);
																				setBaseBranchOpen(false);
																				setBranchSearch("");
																			}}
																			className="flex items-center justify-between"
																		>
																			<span className="flex items-center gap-2 truncate">
																				<GoGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
																				<span className="truncate">{branch.name}</span>
																				{branch.name === branchData?.defaultBranch && (
																					<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
																						default
																					</span>
																				)}
																			</span>
																			<span className="flex items-center gap-2 shrink-0">
																				{branch.lastCommitDate > 0 && (
																					<span className="text-xs text-muted-foreground">
																						{formatRelativeTime(branch.lastCommitDate)}
																					</span>
																				)}
																				{effectiveBaseBranch === branch.name && (
																					<HiCheck className="size-4 text-primary" />
																				)}
																			</span>
																		</CommandItem>
																	))}
																</CommandList>
															</Command>
														</PopoverContent>
													</Popover>
												)}
											</div>

											<div className="space-y-1.5">
												<label htmlFor="setup-script" className="text-xs text-muted-foreground">
													Setup script
												</label>
												<Textarea
													id="setup-script"
													className="min-h-[80px] text-xs font-mono resize-y"
													placeholder={`# Runs when node is created\ncp ../.env .env\nnpm install`}
													value={setupScript}
													onChange={(e) => setSetupScript(e.target.value)}
												/>
											</div>

											<div className="space-y-1.5">
												<label htmlFor="teardown-script" className="text-xs text-muted-foreground">
													Teardown script
												</label>
												<Textarea
													id="teardown-script"
													className="min-h-[80px] text-xs font-mono resize-y"
													placeholder={`# Runs when node is deleted\nrm -rf node_modules\nrm .env`}
													value={teardownScript}
													onChange={(e) => setTeardownScript(e.target.value)}
												/>
											</div>
										</CollapsibleContent>
									</Collapsible>

									<Button
										className="w-full h-8 text-sm"
										onClick={() => handleCreateNode()}
										disabled={
											createNode.isPending ||
											isBranchesError ||
											branchCollision?.type === "has-node"
										}
									>
										Create Node
									</Button>
								</div>
							)}
							{mode === "existing" && (
								<ExistingWorktreesList
									repositoryId={selectedRepositoryId}
									onOpenSuccess={handleClose}
								/>
							)}
							{mode === "cloud" && (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<div className="text-sm font-medium text-foreground mb-1">Cloud Nodes</div>
									<p className="text-xs text-muted-foreground">Coming soon</p>
								</div>
							)}
						</div>
					</>
				)}

				{!selectedRepositoryId && (
					<div className="px-4 pb-4 pt-2">
						<div className="text-center text-sm text-muted-foreground py-8">
							Select a repository to get started
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
