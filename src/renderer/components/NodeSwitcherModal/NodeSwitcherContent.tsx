import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuPlus, LuSearch } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import type {
	FilterMode,
	NodeItem,
	RepositoryGroup,
} from "renderer/screens/main/components/NodesListView/types";
import { getRelativeTime } from "renderer/screens/main/components/NodesListView/utils";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { useCloseNodeSwitcherModal } from "renderer/stores/node-switcher-modal";
import { Input } from "ui/components/ui/input";
import { toast } from "ui/components/ui/sonner";
import { cn } from "ui/lib/utils";

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "closed", label: "Closed" },
];

export function NodeSwitcherContent() {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterMode, setFilterMode] = useState<FilterMode>("all");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();
	const closeModal = useCloseNodeSwitcherModal();
	const openNewNodeModal = useOpenNewNodeModal();
	const utils = electronTrpc.useUtils();

	// Get current node ID to highlight active node
	const { nodeId: currentNodeId } = useParams({ strict: false });

	// Autofocus search input on mount
	useEffect(() => {
		// Small delay to ensure modal is fully rendered
		const timer = setTimeout(() => {
			searchInputRef.current?.focus();
		}, 50);
		return () => clearTimeout(timer);
	}, []);

	// Fetch all data
	const { data: groups = [] } = electronTrpc.nodes.getAllGrouped.useQuery();
	const { data: allRepositoriesRaw = [] } = electronTrpc.repositories.getRecents.useQuery();

	// Only include active repositories (tabOrder != null) to avoid showing closed repos
	const activeRepoIds = useMemo(() => new Set(groups.map((g) => g.repository.id)), [groups]);
	const allRepositories = useMemo(
		() => allRepositoriesRaw.filter((r) => activeRepoIds.has(r.id)),
		[allRepositoriesRaw, activeRepoIds],
	);

	// Fetch worktrees for all repositories
	const worktreeQueries = electronTrpc.useQueries((t) =>
		allRepositories.map((repository) =>
			t.nodes.getWorktreesByRepository({ repositoryId: repository.id }),
		),
	);

	const openWorktree = electronTrpc.nodes.openWorktree.useMutation({
		onSuccess: (data) => {
			utils.nodes.getAllGrouped.invalidate();
			if (data.node?.id) {
				navigateToNode(data.node.id, navigate);
				closeModal();
			}
		},
		onError: (error) => {
			toast.error(`Failed to open node: ${error.message}`);
		},
	});

	// Combine open nodes and closed worktrees into a single list
	const allItems = useMemo<NodeItem[]>(() => {
		const items: NodeItem[] = [];

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
					tabOrder: ws.tabOrder,
					isUnread: ws.isUnread,
					isOpen: true,
				});
			}
		}

		for (let i = 0; i < allRepositories.length; i++) {
			const repository = allRepositories[i];
			const worktrees = worktreeQueries[i]?.data;

			if (!worktrees) continue;

			for (const wt of worktrees) {
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
					tabOrder: Number.MAX_SAFE_INTEGER,
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

		if (filterMode === "active") {
			items = items.filter((ws) => ws.isOpen);
		} else if (filterMode === "closed") {
			items = items.filter((ws) => !ws.isOpen);
		}

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
					repositoryColor: "#6b7280",
					repositoryPath: "",
					nodes: [],
				});
			}
			groupsMap.get(item.repositoryId)?.nodes.push(item);
		}

		for (const group of groupsMap.values()) {
			group.nodes.sort((a, b) => {
				if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
				return b.lastOpenedAt - a.lastOpenedAt;
			});
		}

		return Array.from(groupsMap.values()).sort((a, b) => {
			const aRecent = Math.max(...a.nodes.map((w) => w.lastOpenedAt));
			const bRecent = Math.max(...b.nodes.map((w) => w.lastOpenedAt));
			return bRecent - aRecent;
		});
	}, [filteredItems]);

	const handleSelect = useCallback(
		(item: NodeItem) => {
			if (item.nodeId) {
				navigateToNode(item.nodeId, navigate);
				closeModal();
			} else if (item.worktreeId) {
				openWorktree.mutate({ worktreeId: item.worktreeId });
			}
		},
		[navigate, closeModal, openWorktree],
	);

	const handleNewNode = useCallback(() => {
		closeModal();
		openNewNodeModal();
	}, [closeModal, openNewNodeModal]);

	// Flatten items for keyboard navigation
	const flatItems = useMemo(() => {
		const items: NodeItem[] = [];
		for (const group of repositoryGroups) {
			for (const node of group.nodes) {
				items.push(node);
			}
		}
		return items;
	}, [repositoryGroups]);

	// Reset selection when filtered items change
	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset on any filter/search change, not just length
	useEffect(() => {
		setSelectedIndex(0);
	}, [filteredItems.length, searchQuery, filterMode]);

	// Find next valid index (skipping current node)
	const findNextIndex = useCallback(
		(fromIndex: number, direction: "up" | "down") => {
			const step = direction === "down" ? 1 : -1;
			let nextIndex = fromIndex + step;

			while (nextIndex >= 0 && nextIndex < flatItems.length) {
				const item = flatItems[nextIndex];
				if (item.nodeId !== currentNodeId) {
					return nextIndex;
				}
				nextIndex += step;
			}

			return fromIndex; // No valid index found, stay in place
		},
		[flatItems, currentNodeId],
	);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) => findNextIndex(prev, "down"));
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => findNextIndex(prev, "up"));
					break;
				case "Enter": {
					e.preventDefault();
					const selectedItem = flatItems[selectedIndex];
					if (selectedItem && selectedItem.nodeId !== currentNodeId) {
						handleSelect(selectedItem);
					}
					break;
				}
			}
		},
		[flatItems, selectedIndex, currentNodeId, handleSelect, findNextIndex],
	);

	// Scroll selected item into view
	useEffect(() => {
		const selectedItem = flatItems[selectedIndex];
		if (!selectedItem || !listRef.current) return;

		const selectedElement = listRef.current.querySelector(
			`[data-item-id="${selectedItem.uniqueId}"]`,
		);
		if (selectedElement) {
			selectedElement.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIndex, flatItems]);

	// Count stats for filter badges
	const activeCount = allItems.filter((w) => w.isOpen).length;
	const closedCount = allItems.filter((w) => !w.isOpen).length;

	// Track current flat index for keyboard selection highlight
	let currentFlatIndex = -1;

	return (
		<div className="flex flex-col h-full" role="listbox" onKeyDown={handleKeyDown}>
			{/* Header */}
			<div className="px-4 pt-4 pb-3 space-y-3">
				<h2 className="text-sm font-medium text-foreground">Switch node</h2>

				{/* Search */}
				<div className="relative">
					<LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
					<Input
						ref={searchInputRef}
						type="text"
						placeholder="Search nodes and repositories..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 h-9 bg-background/30 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
					/>
				</div>

				{/* Filters */}
				<div className="flex items-center gap-2.5">
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
									"text-[10px] transition-colors",
									filterMode === option.value
										? "text-muted-foreground font-medium"
										: "text-muted-foreground/50 hover:text-muted-foreground",
								)}
							>
								{option.label}
								<span className="ml-1 opacity-60">{count}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* List */}
			<div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
				{repositoryGroups.map((group) => (
					<div key={group.repositoryId}>
						{/* Repository header - section label styling */}
						<div className="sticky top-0 bg-background px-4 py-2 border-b border-border/20">
							<span className="text-label font-medium text-muted-foreground tracking-wide">
								{group.repositoryName}
							</span>
						</div>

						{/* Nodes - indented relative to repo header */}
						{group.nodes.map((item) => {
							currentFlatIndex++;
							const itemIndex = currentFlatIndex;
							const isCurrentNode = item.nodeId === currentNodeId;
							const isSelected = itemIndex === selectedIndex && !isCurrentNode;
							const isOpening =
								openWorktree.isPending && openWorktree.variables?.worktreeId === item.worktreeId;

							return (
								<button
									key={item.uniqueId}
									data-item-id={item.uniqueId}
									type="button"
									onClick={() => handleSelect(item)}
									onMouseEnter={() => setSelectedIndex(itemIndex)}
									disabled={isOpening || isCurrentNode}
									className={cn(
										"flex items-center gap-3 w-full pl-7 pr-4 py-2.5 text-left",
										"transition-colors",
										isSelected && "bg-muted/50",
										isOpening && "opacity-50 cursor-wait",
										isCurrentNode && "cursor-default",
									)}
								>
									{/* Node name - body text for hierarchy */}
									<span
										className={cn(
											"text-body truncate flex-1",
											isCurrentNode
												? "text-muted-foreground"
												: item.isOpen
													? "text-foreground"
													: "text-muted-foreground",
										)}
									>
										{item.name}
									</span>

									{/* Status cluster: time + current indicator grouped together */}
									<div className="flex items-center gap-1.5 shrink-0">
										<span className="text-[10px] text-muted-foreground/40">
											{getRelativeTime(item.lastOpenedAt)}
										</span>
										{isCurrentNode && <LuCheck className="size-3 text-muted-foreground/50" />}
									</div>
								</button>
							);
						})}
					</div>
				))}

				{filteredItems.length === 0 && (
					<div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
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

			{/* Actions */}
			<div className="px-4 pt-3 pb-4 mt-1">
				<button
					type="button"
					onClick={handleNewNode}
					className="flex items-center gap-1.5 text-caption text-muted-foreground/60 hover:text-muted-foreground transition-colors"
				>
					<LuPlus className="size-3" />
					New node
				</button>
			</div>
		</div>
	);
}
