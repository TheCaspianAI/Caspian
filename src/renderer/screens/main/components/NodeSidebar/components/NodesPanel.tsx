import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useReorderNodes } from "renderer/react-query/nodes/useReorderNodes";
import { useReorderRepositories } from "renderer/react-query/repositories/useReorderRepositories";
import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";
import { toast } from "ui/components/ui/sonner";
import type { NodeItem, RepositoryGroup } from "../../NodesListView/types";
import { FolderDropZone } from "./FolderDropZone";
import { RepositorySection } from "./RepositorySection";

export function NodesPanel({ isCollapsed }: { isCollapsed: boolean }) {
	const { nodeId } = useParams({ strict: false });
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();

	const { data: groups = [] } = electronTrpc.nodes.getAllGrouped.useQuery();
	const { data: allRepositoriesRaw = [] } = electronTrpc.repositories.getRecents.useQuery();

	// Only include active repositories (tabOrder != null) to avoid showing closed repos in sidebar
	const activeRepoIds = useMemo(() => new Set(groups.map((g) => g.repository.id)), [groups]);
	const allRepositories = useMemo(
		() => allRepositoriesRaw.filter((r) => activeRepoIds.has(r.id)),
		[allRepositoriesRaw, activeRepoIds],
	);

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
			}
		},
		onError: (error) => {
			toast.error(`Failed to open node: ${error.message}`);
		},
	});

	const reorderNodes = useReorderNodes();
	const reorderRepositories = useReorderRepositories();

	const repoMetaMap = useMemo(() => {
		const map = new Map<string, { color: string; path: string }>();
		for (const group of groups) {
			const color = group.repository.color === "default" ? "#6b7280" : group.repository.color;
			map.set(group.repository.id, { color, path: group.repository.mainRepoPath });
		}
		return map;
	}, [groups]);

	const repositoryGroups = useMemo<RepositoryGroup[]>(() => {
		const items: NodeItem[] = [];

		// Build a map of repositoryId → backend index to preserve backend tabOrder for groups
		const repoOrderMap = new Map<string, number>();
		for (let i = 0; i < groups.length; i++) {
			repoOrderMap.set(groups[i].repository.id, i);
		}

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

		const groupsMap = new Map<string, RepositoryGroup>();
		for (const item of items) {
			if (!groupsMap.has(item.repositoryId)) {
				const meta = repoMetaMap.get(item.repositoryId);
				groupsMap.set(item.repositoryId, {
					repositoryId: item.repositoryId,
					repositoryName: item.repositoryName,
					repositoryColor: meta?.color ?? "#6b7280",
					repositoryPath: meta?.path ?? "",
					nodes: [],
				});
			}
			groupsMap.get(item.repositoryId)?.nodes.push(item);
		}

		for (const group of groupsMap.values()) {
			group.nodes.sort((a, b) => {
				if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
				return a.tabOrder - b.tabOrder;
			});
		}

		return Array.from(groupsMap.values()).sort((a, b) => {
			const aOrder = repoOrderMap.get(a.repositoryId) ?? Number.MAX_SAFE_INTEGER;
			const bOrder = repoOrderMap.get(b.repositoryId) ?? Number.MAX_SAFE_INTEGER;
			return aOrder - bOrder;
		});
	}, [groups, allRepositories, worktreeQueries, repoMetaMap]);

	const shortcutIndexMap = useMemo(() => {
		const map = new Map<string, number>();
		let index = 0;
		for (const group of repositoryGroups) {
			for (const node of group.nodes) {
				if (node.isOpen && node.nodeId && index < 9) {
					map.set(node.nodeId, index);
					index++;
				}
			}
		}
		return map;
	}, [repositoryGroups]);

	const handleNodeSelect = (node: NodeItem) => {
		if (node.nodeId) {
			navigateToNode(node.nodeId, navigate);
		} else if (node.worktreeId) {
			openWorktree.mutate({ worktreeId: node.worktreeId });
		}
	};

	// Optimistically reorder nodes in the query cache during drag hover
	const handleNodeHoverReorder = useCallback(
		(repositoryId: string, dragIndex: number, hoverIndex: number) => {
			utils.nodes.getAllGrouped.setData(undefined, (old) => {
				if (!old) return old;
				return old.map((group) => {
					if (group.repository.id !== repositoryId) return group;

					const nodes = [...group.nodes];
					if (dragIndex >= nodes.length || hoverIndex >= nodes.length) return group;

					const [removed] = nodes.splice(dragIndex, 1);
					if (!removed) return group;
					nodes.splice(hoverIndex, 0, removed);

					return { ...group, nodes };
				});
			});
		},
		[utils],
	);

	// Persist node reorder to backend on drop
	const handleNodeDropReorder = useCallback(
		(repositoryId: string, fromIndex: number, toIndex: number) => {
			reorderNodes.mutate({ repositoryId, fromIndex, toIndex });
		},
		[reorderNodes],
	);

	// Optimistically reorder repository groups in the query cache during drag hover
	const handleRepoHoverReorder = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			utils.nodes.getAllGrouped.setData(undefined, (old) => {
				if (!old) return old;
				const newGroups = [...old];
				if (dragIndex >= newGroups.length || hoverIndex >= newGroups.length) return old;

				const [removed] = newGroups.splice(dragIndex, 1);
				if (!removed) return old;
				newGroups.splice(hoverIndex, 0, removed);

				return newGroups;
			});
		},
		[utils],
	);

	// Persist repository reorder to backend on drop
	const handleRepoDropReorder = useCallback(
		(fromIndex: number, toIndex: number) => {
			reorderRepositories.mutate({ fromIndex, toIndex });
		},
		[reorderRepositories],
	);

	return (
		<>
			<div className="flex-1 overflow-y-auto min-h-0 pt-1">
				{repositoryGroups.length === 0 ? (
					<div className="flex flex-1 items-center justify-center text-muted-foreground text-caption">
						{!isCollapsed && "Open a node to get started"}
					</div>
				) : (
					repositoryGroups.map((group, groupIndex) => (
						<RepositorySection
							key={group.repositoryId}
							group={group}
							index={groupIndex}
							activeNodeId={nodeId ?? null}
							onNodeSelect={handleNodeSelect}
							openingWorktreeId={
								openWorktree.isPending ? (openWorktree.variables?.worktreeId ?? null) : null
							}
							shortcutIndexMap={shortcutIndexMap}
							isCollapsed={isCollapsed}
							onNodeHoverReorder={handleNodeHoverReorder}
							onNodeDropReorder={handleNodeDropReorder}
							onRepoHoverReorder={handleRepoHoverReorder}
							onRepoDropReorder={handleRepoDropReorder}
						/>
					))
				)}
			</div>
			{!isCollapsed && <FolderDropZone />}
		</>
	);
}
