import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import {
	LuCircleDot,
	LuExternalLink,
	LuGitMerge,
	LuGitPullRequest,
	LuLoaderCircle,
	LuTriangleAlert,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { Button } from "ui/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "ui/components/ui/hover-card";
import { cn } from "ui/lib/utils";
import { ChecksList } from "./ChecksList";

interface NodeHoverCardProps {
	nodeId: string;
	nodeName?: string;
	children: ReactNode;
}

const PR_STATE_CONFIG = {
	open: { icon: LuGitPullRequest, className: "bg-emerald-500/10 text-emerald-500" },
	draft: { icon: LuGitPullRequest, className: "bg-muted text-muted-foreground" },
	merged: { icon: LuGitMerge, className: "bg-purple-500/10 text-purple-500" },
	closed: { icon: LuCircleDot, className: "bg-destructive/10 text-destructive" },
} as const;

const CHECKS_CONFIG = {
	success: { label: "Checks passing", className: "text-emerald-500" },
	failure: { label: "Checks failing", className: "text-red-400" },
	pending: { label: "Checks pending", className: "text-amber-500" },
	none: { label: "No checks", className: "text-muted-foreground" },
} as const;

const REVIEW_CONFIG = {
	approved: { label: "Approved", className: "text-emerald-500" },
	changes_requested: { label: "Changes requested", className: "text-amber-500" },
	pending: { label: "Review pending", className: "text-muted-foreground" },
} as const;

export function NodeHoverCard({ nodeId, nodeName, children }: NodeHoverCardProps) {
	const [hasHovered, setHasHovered] = useState(false);

	const { data, isLoading, isError } = electronTrpc.nodes.getWorktreeInfo.useQuery(
		{ nodeId },
		{ enabled: hasHovered, staleTime: 30_000 },
	);

	const gitStatus = data?.gitStatus;
	const githubStatus = data?.githubStatus;
	const pr = githubStatus?.pr;
	const hasAlias = nodeName && data?.worktreeName && nodeName !== data.worktreeName;

	return (
		<HoverCard
			openDelay={400}
			closeDelay={100}
			onOpenChange={(open) => open && setHasHovered(true)}
		>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent side="right" align="start" className="w-72 p-3">
				{!hasHovered || isLoading ? (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<LuLoaderCircle className="size-3 animate-spin" />
						Loading...
					</div>
				) : isError || !data ? (
					<div className="text-xs text-muted-foreground">No info available</div>
				) : (
					<div className="space-y-2">
						{/* Header: alias + branch label + branch name + time */}
						<div className="space-y-1.5">
							{hasAlias && <div className="text-xs font-medium text-foreground">{nodeName}</div>}
							<div className="space-y-0.5">
								<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
									Branch
								</span>
								{githubStatus?.repoUrl && githubStatus.branchExistsOnRemote ? (
									<a
										href={`${githubStatus.repoUrl}/tree/${gitStatus?.branch}`}
										target="_blank"
										rel="noopener noreferrer"
										className={cn(
											"flex items-center gap-1 font-mono break-all hover:underline",
											hasAlias ? "text-xs" : "text-[11px]",
										)}
									>
										{gitStatus?.branch ?? "unknown"}
										<LuExternalLink className="size-3 shrink-0" />
									</a>
								) : (
									<code
										className={cn(
											"font-mono break-all block",
											hasAlias ? "text-xs" : "text-[11px]",
										)}
									>
										{gitStatus?.branch ?? "unknown"}
									</code>
								)}
							</div>
							{data.createdAt && (
								<span className="text-xs text-muted-foreground block">
									{formatDistanceToNow(data.createdAt, { addSuffix: true })}
								</span>
							)}
						</div>

						{/* Needs rebase warning */}
						{gitStatus?.needsRebase && (
							<div className="flex items-center gap-2 text-amber-500 text-xs bg-amber-500/10 px-2 py-1.5 rounded-md">
								<LuTriangleAlert className="size-3.5 shrink-0" />
								<span>Behind main, needs rebase</span>
							</div>
						)}

						{/* PR section */}
						{pr && (
							<div className="space-y-2 pt-2 border-t border-border/40">
								{/* PR header: number + state badge + diff stats */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1.5">
										<span className="text-[11px] font-mono text-muted-foreground">
											#{pr.number}
										</span>
										<PrStateBadge state={pr.state} />
									</div>
									{(pr.additions > 0 || pr.deletions > 0) && (
										<div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
											{pr.additions > 0 && (
												<span className="text-emerald-500/90">+{pr.additions}</span>
											)}
											{pr.deletions > 0 && (
												<span className="text-red-400/90">&minus;{pr.deletions}</span>
											)}
										</div>
									)}
								</div>

								{/* PR title */}
								<p className="text-xs text-foreground/90 line-clamp-2 leading-snug">{pr.title}</p>

								{/* Checks + Review (only for open/draft PRs) */}
								{(pr.state === "open" || pr.state === "draft") && (
									<>
										<div className="flex items-center gap-3 text-[10px]">
											<span className={CHECKS_CONFIG[pr.checksStatus].className}>
												{CHECKS_CONFIG[pr.checksStatus].label}
											</span>
											<span className="text-muted-foreground">&middot;</span>
											<span className={REVIEW_CONFIG[pr.reviewDecision].className}>
												{REVIEW_CONFIG[pr.reviewDecision].label}
											</span>
										</div>
										{pr.checks.length > 0 && <ChecksList checks={pr.checks} />}
									</>
								)}

								{/* View on GitHub button */}
								<Button
									variant="outline"
									size="sm"
									className="w-full mt-1 h-7 text-xs gap-1.5"
									asChild
								>
									<a href={pr.url} target="_blank" rel="noopener noreferrer">
										<FaGithub className="size-3" />
										View on GitHub
									</a>
								</Button>
							</div>
						)}

						{/* No PR message */}
						{!pr && githubStatus && (
							<span className="text-[10px] text-muted-foreground/50 pt-2 border-t border-border/40 block">
								No PR for this branch
							</span>
						)}
					</div>
				)}
			</HoverCardContent>
		</HoverCard>
	);
}

function PrStateBadge({ state }: { state: "open" | "draft" | "merged" | "closed" }) {
	const config = PR_STATE_CONFIG[state];
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
				config.className,
			)}
		>
			<Icon className="size-3" />
			{state.charAt(0).toUpperCase() + state.slice(1)}
		</span>
	);
}
