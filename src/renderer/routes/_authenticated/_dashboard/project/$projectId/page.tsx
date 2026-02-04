import { Button } from "ui/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "ui/components/ui/collapsible";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "ui/components/ui/command";
import { Input } from "ui/components/ui/input";
import { Textarea } from "ui/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "ui/components/ui/popover";
import { toast } from "ui/components/ui/sonner";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoGitBranch } from "react-icons/go";
import { HiCheck, HiChevronDown, HiChevronUpDown } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { electronTrpcClient as trpcClient } from "renderer/lib/trpc-client";
import { useCreateNode } from "renderer/react-query/nodes";
import { NotFound } from "renderer/routes/not-found";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/project/$projectId/",
)({
	component: ProjectPage,
	notFoundComponent: NotFound,
	loader: async ({ params, context }) => {
		const queryKey = [
			["repositories", "get"],
			{ input: { id: params.projectId }, type: "query" },
		];

		try {
			await context.queryClient.ensureQueryData({
				queryKey,
				queryFn: () => trpcClient.repositories.get.query({ id: params.projectId }),
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				throw notFound();
			}
			throw error;
		}
	},
});

function generateBranchFromTitle({
	title,
	authorPrefix,
}: {
	title: string;
	authorPrefix?: string;
}): string {
	if (!title.trim()) return "";

	const slug = title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);

	if (!slug) return "";

	if (authorPrefix) {
		return `${authorPrefix}/${slug}`;
	}
	return slug;
}

function ProjectPage() {
	const { projectId } = Route.useParams();

	const { data: project } = electronTrpc.repositories.get.useQuery({
		id: projectId,
	});
	const {
		data: branchData,
		isLoading: isBranchesLoading,
		isError: isBranchesError,
	} = electronTrpc.repositories.getBranches.useQuery(
		{ repositoryId: projectId },
		{ enabled: !!projectId },
	);
	const { data: gitAuthor } = electronTrpc.repositories.getGitAuthor.useQuery(
		{ id: projectId },
		{ enabled: !!projectId },
	);

	const createNode = useCreateNode();
	const authorPrefix = gitAuthor?.prefix;

	const [title, setTitle] = useState("");
	const [baseBranch, setBaseBranch] = useState<string | null>(null);
	const [baseBranchOpen, setBaseBranchOpen] = useState(false);
	const [branchSearch, setBranchSearch] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [setupScript, setSetupScript] = useState("");
	const [teardownScript, setTeardownScript] = useState("");
	const titleInputRef = useRef<HTMLInputElement>(null);

	const filteredBranches = useMemo(() => {
		if (!branchData?.branches) return [];
		if (!branchSearch) return branchData.branches;
		const searchLower = branchSearch.toLowerCase();
		return branchData.branches.filter((b) =>
			b.name.toLowerCase().includes(searchLower),
		);
	}, [branchData?.branches, branchSearch]);

	const effectiveBaseBranch = baseBranch ?? branchData?.defaultBranch ?? null;

	useEffect(() => {
		const timer = setTimeout(() => {
			titleInputRef.current?.focus();
		}, 100);
		return () => clearTimeout(timer);
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey && !createNode.isPending) {
			e.preventDefault();
			handleCreateNode();
		}
	};

	const handleCreateNode = async () => {
		const nodeName = title.trim() || undefined;
		const generatedBranchName = generateBranchFromTitle({
			title,
			authorPrefix,
		});

		try {
			await createNode.mutateAsync({
				repositoryId: projectId,
				name: nodeName,
				branchName: generatedBranchName || undefined,
				baseBranch: effectiveBaseBranch || undefined,
			});

			toast.success("Node created", {
				description: "Setting up in the background...",
			});
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to create node",
			);
		}
	};

	if (!project) {
		return null;
	}

	return (
		<div className="flex-1 h-full flex flex-col overflow-hidden bg-background">
			<div className="flex-1 flex overflow-y-auto">
				{/* Main content */}
				<div className="flex-1 flex items-center justify-center py-12">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: Form container handles Enter key for submission */}
					<div
						className="w-full max-w-xl text-center"
						onKeyDown={handleKeyDown}
					>
						{/* Project context */}
						<div className="flex items-center justify-center gap-2 mb-8">
							<span className="text-sm text-muted-foreground/80">
								{project.name}
							</span>
							<span className="text-muted-foreground/30">·</span>
							<span className="text-sm text-muted-foreground/60 font-mono">
								{branchData?.defaultBranch ?? "main"}
							</span>
						</div>

						{/* Headline */}
						<h1 className="text-3xl font-normal text-foreground tracking-tight mb-4">
							What are you building?
						</h1>

						{/* Subtext */}
						<p className="text-base text-muted-foreground/80 mb-16">
							Each node is an isolated copy of your codebase.
							<br />
							Work on multiple tasks without conflicts.
						</p>

						{/* Form */}
						<div className="space-y-5 max-w-md mx-auto">
							<div className="space-y-2">
								<label
									htmlFor="task-title"
									className="block text-sm text-muted-foreground/70"
								>
									Name your task
								</label>
								<Input
									id="task-title"
									ref={titleInputRef}
									className="h-12 text-base text-center"
									placeholder="e.g. Add dark mode, Fix checkout bug"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
								/>
							</div>

							<p
								className={`text-sm text-muted-foreground/70 flex items-center justify-center gap-2 transition-opacity duration-300 ${title ? "opacity-100" : "opacity-0"}`}
							>
								<GoGitBranch className="size-3.5" />
								<span className="font-mono">
									{generateBranchFromTitle({ title, authorPrefix }) ||
										"branch-name"}
								</span>
								<span className="text-muted-foreground/40">
									from {effectiveBaseBranch}
								</span>
							</p>

							<Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
								<CollapsibleTrigger className="flex items-center justify-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 w-full">
									<HiChevronDown
										className={`size-3.5 transition-transform duration-200 ${showAdvanced ? "" : "-rotate-90"}`}
									/>
									Advanced
								</CollapsibleTrigger>
								<AnimatePresence initial={false}>
									{showAdvanced && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={{
												duration: 0.3,
												ease: [0.4, 0, 0.2, 1],
											}}
											className="overflow-hidden"
										>
											<div className="pt-4 space-y-4 text-left">
												<div className="space-y-2">
													<span className="text-sm text-muted-foreground/70">
														Change base branch
													</span>
												{isBranchesError ? (
													<div className="flex items-center gap-2 h-10 px-3 rounded-md border border-destructive/50 bg-destructive/10 text-destructive text-sm">
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
																className="w-full h-10 justify-between font-normal"
																disabled={isBranchesLoading}
															>
																<span className="flex items-center gap-2 truncate">
																	<GoGitBranch className="size-4 shrink-0 text-muted-foreground" />
																	<span className="truncate font-mono">
																		{effectiveBaseBranch || "Select branch..."}
																	</span>
																	{effectiveBaseBranch ===
																		branchData?.defaultBranch && (
																		<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
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
																				<span className="truncate">
																					{branch.name}
																				</span>
																				{branch.name ===
																					branchData?.defaultBranch && (
																					<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
																						default
																					</span>
																				)}
																			</span>
																			<span className="flex items-center gap-2 shrink-0">
																				{branch.lastCommitDate > 0 && (
																					<span className="text-xs text-muted-foreground">
																						{formatRelativeTime(
																							branch.lastCommitDate,
																						)}
																					</span>
																				)}
																				{effectiveBaseBranch ===
																					branch.name && (
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

												<div className="space-y-2">
													<label
														htmlFor="setup-script"
														className="block text-sm text-muted-foreground/70"
													>
														Setup script
													</label>
													<Textarea
														id="setup-script"
														className="font-mono text-sm min-h-[80px] resize-none"
														placeholder={`# Runs when node is created\ncp ../.env .env\nnpm install`}
														value={setupScript}
														onChange={(e) => setSetupScript(e.target.value)}
													/>
												</div>

												<div className="space-y-2">
													<label
														htmlFor="teardown-script"
														className="block text-sm text-muted-foreground/70"
													>
														Teardown script
													</label>
													<Textarea
														id="teardown-script"
														className="font-mono text-sm min-h-[80px] resize-none"
														placeholder={`# Runs when node is deleted\nrm -rf node_modules\nrm .env`}
														value={teardownScript}
														onChange={(e) => setTeardownScript(e.target.value)}
													/>
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</Collapsible>

							<Button
								variant="secondary"
								size="lg"
								className="w-full mt-2"
								onClick={handleCreateNode}
								disabled={createNode.isPending || isBranchesError}
							>
								{createNode.isPending ? "Creating..." : "Create node"}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
