import { toast } from "ui/components/ui/sonner";
import { cn } from "ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useDrag, useDrop } from "react-dnd";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useReorderRepositories } from "renderer/react-query/repositories";
import { useNodeSidebarStore } from "renderer/stores";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { NodeListItem } from "../NodeListItem";
import { RepositoryHeader } from "./RepositoryHeader";

const REPOSITORY_TYPE = "REPOSITORY";

interface Node {
	id: string;
	repositoryId: string;
	worktreePath: string;
	type: "worktree" | "branch";
	branch: string;
	name: string;
	tabOrder: number;
	isUnread: boolean;
}

interface RepositorySectionProps {
	repositoryId: string;
	repositoryName: string;
	repositoryColor: string;
	githubOwner: string | null;
	mainRepoPath: string;
	nodes: Node[];
	/** Base index for keyboard shortcuts (0-based) */
	shortcutBaseIndex: number;
	/** Index for drag-and-drop reordering */
	index: number;
	/** Whether the sidebar is in collapsed mode */
	isCollapsed?: boolean;
}

export function RepositorySection({
	repositoryId,
	repositoryName,
	repositoryColor,
	githubOwner,
	mainRepoPath,
	nodes,
	shortcutBaseIndex,
	index,
	isCollapsed: isSidebarCollapsed = false,
}: RepositorySectionProps) {
	const { isRepositoryCollapsed, toggleRepositoryCollapsed } =
		useNodeSidebarStore();
	const openModal = useOpenNewNodeModal();
	const reorderRepositories = useReorderRepositories();
	const utils = electronTrpc.useUtils();

	const isCollapsed = isRepositoryCollapsed(repositoryId);

	const handleNewNode = () => {
		openModal(repositoryId);
	};

	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: REPOSITORY_TYPE,
			item: { repositoryId, index, originalIndex: index },
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[repositoryId, index],
	);

	const [, drop] = useDrop({
		accept: REPOSITORY_TYPE,
		hover: (item: {
			repositoryId: string;
			index: number;
			originalIndex: number;
		}) => {
			if (item.index !== index) {
				utils.nodes.getAllGrouped.setData(undefined, (oldData) => {
					if (!oldData) return oldData;
					const newGroups = [...oldData];
					const [moved] = newGroups.splice(item.index, 1);
					newGroups.splice(index, 0, moved);
					return newGroups;
				});
				item.index = index;
			}
		},
		drop: (item: {
			repositoryId: string;
			index: number;
			originalIndex: number;
		}) => {
			if (item.originalIndex !== item.index) {
				reorderRepositories.mutate(
					{ fromIndex: item.originalIndex, toIndex: item.index },
					{
						onError: (error) =>
							toast.error(`Failed to reorder: ${error.message}`),
					},
				);
			}
		},
	});

	if (isSidebarCollapsed) {
		return (
			<div
				ref={(node) => {
					drag(drop(node));
				}}
				className={cn(
					"flex flex-col items-center py-2 border-b border-border last:border-b-0",
					isDragging && "opacity-30",
				)}
				style={{ cursor: isDragging ? "grabbing" : "grab" }}
			>
				<RepositoryHeader
					repositoryId={repositoryId}
					repositoryName={repositoryName}
					repositoryColor={repositoryColor}
					githubOwner={githubOwner}
					mainRepoPath={mainRepoPath}
					isCollapsed={isCollapsed}
					isSidebarCollapsed={isSidebarCollapsed}
					onToggleCollapse={() => toggleRepositoryCollapsed(repositoryId)}
					nodeCount={nodes.length}
					onNewNode={handleNewNode}
				/>
				<AnimatePresence initial={false}>
					{!isCollapsed && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
							className="overflow-hidden w-full"
						>
							<div className="flex flex-col items-center gap-1 pt-1">
								{nodes.map((node, nodeIndex) => (
									<NodeListItem
										key={node.id}
										id={node.id}
										repositoryId={node.repositoryId}
										worktreePath={node.worktreePath}
										name={node.name}
										branch={node.branch}
										type={node.type}
										isUnread={node.isUnread}
										index={nodeIndex}
										shortcutIndex={shortcutBaseIndex + nodeIndex}
										isCollapsed={isSidebarCollapsed}
									/>
								))}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		);
	}

	return (
		<div
			ref={(node) => {
				drag(drop(node));
			}}
			className={cn(
				"border-b border-border last:border-b-0",
				isDragging && "opacity-30",
			)}
			style={{ cursor: isDragging ? "grabbing" : "grab" }}
		>
			<RepositoryHeader
				repositoryId={repositoryId}
				repositoryName={repositoryName}
				repositoryColor={repositoryColor}
				githubOwner={githubOwner}
				mainRepoPath={mainRepoPath}
				isCollapsed={isCollapsed}
				isSidebarCollapsed={isSidebarCollapsed}
				onToggleCollapse={() => toggleRepositoryCollapsed(repositoryId)}
				nodeCount={nodes.length}
				onNewNode={handleNewNode}
			/>

			<AnimatePresence initial={false}>
				{!isCollapsed && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="pb-1">
							{nodes.map((node, nodeIndex) => (
								<NodeListItem
									key={node.id}
									id={node.id}
									repositoryId={node.repositoryId}
									worktreePath={node.worktreePath}
									name={node.name}
									branch={node.branch}
									type={node.type}
									isUnread={node.isUnread}
									index={nodeIndex}
									shortcutIndex={shortcutBaseIndex + nodeIndex}
								/>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
