import { Button } from "ui/components/ui/button";
import { Input } from "ui/components/ui/input";
import { toast } from "ui/components/ui/sonner";
import { cn } from "ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import type { FilterMode, RepositoryGroup, NodeItem } from "./types";
import { NodeRow } from "./NodeRow";

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "closed", label: "Closed" },
];

export function NodesListView() {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterMode, setFilterMode] = useState<FilterMode>("all");
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();

	// Fetch all data
	const { data: groups = [] } =
		electronTrpc.nodes.getAllGrouped.useQuery();
	const { data: allRepositories = [] } =
		electronTrpc.repositories.getRecents.useQuery();

	// Fetch worktrees for all repositories
	const worktreeQueries = electronTrpc.useQueries((t) =>
		allRepositories.map((repository) =>
			t.nodes.getWorktreesByRepository({ repositoryId: repository.id }),
		),
	);

	const openWorktree = electronTrpc.nodes.openWorktree.useMutation({
		onSuccess: (data) => {
			utils.nodes.getAllGrouped.invalidate();
			// Navigate to the newly opened node
			if (data.node?.id) {
				navigateToNode(data.node.id, navigate);
			}
		},
		onError: (error) => {
			toast.error(`Failed to open node: ${error.message}`);
		},
	});

	// Combine open nodes and closed worktrees into a single list
	const allItems = useMemo<NodeItem[]>(() => {
		const items: NodeItem[] = [];

		// First, add all open nodes from groups
		for (const group of groups) {
			for (const ws of group.nodes) {
				items.push({
					uniqueId: ws.id,
					nodeId: ws.id,
					worktreeId: null,
					repositoryId: ws.repositoryId,
					repositoryName: group.repository.name,
					worktreePath: ws.worktreePath,
					type: ws.type,
					branch: ws.branch,
					name: ws.name,
					lastOpenedAt: ws.lastOpenedAt,
					createdAt: ws.createdAt,
					isUnread: ws.isUnread,
					isOpen: true,
				});
			}
		}

		// Add closed worktrees (those without active nodes)
		for (let i = 0; i < allRepositories.length; i++) {
			const repository = allRepositories[i];
			const worktrees = worktreeQueries[i]?.data;

			if (!worktrees) continue;

			for (const wt of worktrees) {
				// Skip if this worktree has an active node
				if (wt.hasActiveNode) continue;

				items.push({
					uniqueId: `wt-${wt.id}`,
					nodeId: null,
					worktreeId: wt.id,
					repositoryId: repository.id,
					repositoryName: repository.name,
					worktreePath: wt.path,
					type: "worktree",
					branch: wt.branch,
					name: wt.branch,
					lastOpenedAt: wt.createdAt,
					createdAt: wt.createdAt,
					isUnread: false,
					isOpen: false,
				});
			}
		}

		return items;
	}, [groups, allRepositories, worktreeQueries]);

	// Filter by search query and filter mode
	const filteredItems = useMemo(() => {
		let items = allItems;

		// Apply filter mode
		if (filterMode === "active") {
			items = items.filter((ws) => ws.isOpen);
		} else if (filterMode === "closed") {
			items = items.filter((ws) => !ws.isOpen);
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			items = items.filter(
				(ws) =>
					ws.name.toLowerCase().includes(query) ||
					ws.repositoryName.toLowerCase().includes(query) ||
					ws.branch.toLowerCase().includes(query),
			);
		}

		return items;
	}, [allItems, searchQuery, filterMode]);

	// Group by repository
	const repositoryGroups = useMemo<RepositoryGroup[]>(() => {
		const groupsMap = new Map<string, RepositoryGroup>();

		for (const item of filteredItems) {
			if (!groupsMap.has(item.repositoryId)) {
				groupsMap.set(item.repositoryId, {
					repositoryId: item.repositoryId,
					repositoryName: item.repositoryName,
					nodes: [],
				});
			}
			groupsMap.get(item.repositoryId)?.nodes.push(item);
		}

		// Sort nodes within each group: active first, then by lastOpenedAt
		for (const group of groupsMap.values()) {
			group.nodes.sort((a, b) => {
				// Active nodes first
				if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
				// Then by most recently opened/created
				return b.lastOpenedAt - a.lastOpenedAt;
			});
		}

		// Sort groups by most recent activity
		return Array.from(groupsMap.values()).sort((a, b) => {
			const aRecent = Math.max(...a.nodes.map((w) => w.lastOpenedAt));
			const bRecent = Math.max(...b.nodes.map((w) => w.lastOpenedAt));
			return bRecent - aRecent;
		});
	}, [filteredItems]);

	const handleSwitch = (item: NodeItem) => {
		if (item.nodeId) {
			navigateToNode(item.nodeId, navigate);
		}
	};

	const handleReopen = (item: NodeItem) => {
		if (item.worktreeId) {
			openWorktree.mutate({ worktreeId: item.worktreeId });
		}
	};

	// Count stats for filter badges
	const activeCount = allItems.filter((w) => w.isOpen).length;
	const closedCount = allItems.filter((w) => !w.isOpen).length;

	return (
		<div className="flex-1 flex flex-col bg-card overflow-hidden">
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-2 border-b border-border/50">
				{/* Filter toggle */}
				<div className="flex items-center gap-1 bg-background/50 rounded-md p-0.5">
					{FILTER_OPTIONS.map((option) => {
						const count =
							option.value === "all"
								? allItems.length
								: option.value === "active"
									? activeCount
									: closedCount;
						return (
							<button
								key={option.value}
								type="button"
								onClick={() => setFilterMode(option.value)}
								className={cn(
									"px-2 py-1 text-xs rounded-md transition-colors",
									filterMode === option.value
										? "bg-accent text-foreground"
										: "text-foreground/60 hover:text-foreground",
								)}
							>
								{option.label}
								<span className="ml-1 text-foreground/40">{count}</span>
							</button>
						);
					})}
				</div>

				{/* Search */}
				<div className="relative flex-1">
					<LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
					<Input
						type="text"
						placeholder="Search..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 h-8 bg-background/50"
					/>
				</div>

				{/* Close button */}
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/workspace" })}
					className="size-7 text-foreground/60 hover:text-foreground shrink-0"
				>
					<LuX className="size-4" />
				</Button>
			</div>

			{/* Nodes list grouped by repository */}
			<div className="flex-1 overflow-y-auto">
				{repositoryGroups.map((group) => (
					<div key={group.repositoryId}>
						{/* Repository header */}
						<div className="sticky top-0 bg-card/95 backdrop-blur-sm px-4 py-2 border-b border-border/50">
							<span className="text-xs font-medium text-foreground/70">
								{group.repositoryName}
							</span>
							<span className="text-xs text-foreground/40 ml-2">
								{group.nodes.length}
							</span>
						</div>

						{/* Nodes in this repository */}
						{group.nodes.map((ws) => (
							<NodeRow
								key={ws.uniqueId}
								node={ws}
								onSwitch={() => handleSwitch(ws)}
								onReopen={() => handleReopen(ws)}
								isOpening={
									openWorktree.isPending &&
									openWorktree.variables?.worktreeId === ws.worktreeId
								}
							/>
						))}
					</div>
				))}

				{filteredItems.length === 0 && (
					<div className="flex items-center justify-center h-32 text-foreground/50 text-sm">
						{searchQuery
							? "No nodes match your search"
							: filterMode === "active"
								? "No active nodes"
								: filterMode === "closed"
									? "No closed nodes"
									: "No nodes yet"}
					</div>
				)}
			</div>
		</div>
	);
}
