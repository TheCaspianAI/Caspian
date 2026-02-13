import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { LuCopy, LuEye, LuEyeOff, LuFolderOpen, LuPencil, LuX } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "ui/components/ui/context-menu";
import { toast } from "ui/components/ui/sonner";
import type { NodeItem } from "../../NodesListView/types";

interface SidebarNodeContextMenuProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
	node: NodeItem;
	onClose?: () => void;
	onRename?: () => void;
	children: ReactNode;
	ref?: Ref<HTMLSpanElement>;
}

export function SidebarNodeContextMenu({
	node,
	onClose,
	onRename,
	children,
	ref,
	...rest
}: SidebarNodeContextMenuProps) {
	const openInFinder = electronTrpc.external.openInFinder.useMutation();
	const utils = electronTrpc.useUtils();
	const setUnread = electronTrpc.nodes.setUnread.useMutation({
		onSuccess: () => {
			utils.nodes.getAllGrouped.invalidate();
		},
		onError: (error) => toast.error(`Failed to update: ${error.message}`),
	});

	const handleRevealInFinder = () => {
		if (node.worktreePath) {
			openInFinder.mutate(node.worktreePath);
		}
	};

	const handleCopyPath = async () => {
		if (node.worktreePath) {
			await navigator.clipboard.writeText(node.worktreePath);
			toast.success("Path copied to clipboard");
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild ref={ref} {...rest}>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				{node.type !== "branch" && onRename && (
					<>
						<ContextMenuItem onClick={onRename} className="gap-2 text-xs">
							<LuPencil className="size-3.5" />
							Rename
						</ContextMenuItem>
						<ContextMenuSeparator />
					</>
				)}
				<ContextMenuItem
					onClick={handleRevealInFinder}
					disabled={!node.worktreePath}
					className="gap-2 text-xs"
				>
					<LuFolderOpen className="size-3.5" />
					Reveal in Finder
				</ContextMenuItem>
				<ContextMenuItem
					onClick={handleCopyPath}
					disabled={!node.worktreePath}
					className="gap-2 text-xs"
				>
					<LuCopy className="size-3.5" />
					Copy Path
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => navigator.clipboard.writeText(node.branch)}
					className="gap-2 text-xs"
				>
					<LuCopy className="size-3.5" />
					Copy Branch Name
				</ContextMenuItem>
				{node.isOpen && node.nodeId && (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem
							onClick={() => setUnread.mutate({ id: node.nodeId!, isUnread: !node.isUnread })}
							className="gap-2 text-xs"
						>
							{node.isUnread ? <LuEyeOff className="size-3.5" /> : <LuEye className="size-3.5" />}
							{node.isUnread ? "Mark as Read" : "Mark as Unread"}
						</ContextMenuItem>
					</>
				)}
				{node.isOpen && node.nodeId && onClose && node.type !== "branch" && (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem
							onClick={onClose}
							className="gap-2 text-xs text-destructive focus:text-destructive"
						>
							<LuX className="size-3.5" />
							Delete Node
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
