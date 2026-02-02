import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { useMatchRoute } from "@tanstack/react-router";
import { LuPlus } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	useEffectiveHotkeysMap,
	useHotkeysStore,
} from "renderer/stores/hotkeys";
import { useOpenNewNodeModal } from "renderer/stores/new-node-modal";
import { formatHotkeyText } from "shared/hotkeys";
import { STROKE_WIDTH_THICK } from "../constants";

interface NewNodeButtonProps {
	isCollapsed?: boolean;
}

export function NewNodeButton({
	isCollapsed = false,
}: NewNodeButtonProps) {
	const openModal = useOpenNewNodeModal();
	const platform = useHotkeysStore((state) => state.platform);
	const effective = useEffectiveHotkeysMap();
	const shortcutText = formatHotkeyText(effective.NEW_NODE, platform);

	// Derive current node from route to pre-select repository in modal
	const matchRoute = useMatchRoute();
	const currentNodeMatch = matchRoute({
		to: "/node/$nodeId",
		fuzzy: true,
	});
	const currentNodeId = currentNodeMatch
		? currentNodeMatch.nodeId
		: null;

	const { data: currentNode } = electronTrpc.nodes.get.useQuery(
		{ id: currentNodeId ?? "" },
		{ enabled: !!currentNodeId },
	);

	const handleClick = () => {
		// repositoryId may be undefined if no node is active in route
		// openModal handles undefined by opening without a pre-selected repository
		const repositoryId = currentNode?.repositoryId;
		openModal(repositoryId);
	};

	if (isCollapsed) {
		return (
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={handleClick}
						className="group flex items-center justify-center size-8 rounded-md hover:bg-accent/50 transition-colors"
					>
						<div className="flex items-center justify-center size-5 rounded bg-accent">
							<LuPlus className="size-3" strokeWidth={STROKE_WIDTH_THICK} />
						</div>
					</button>
				</TooltipTrigger>
				<TooltipContent side="right">
					New Node ({shortcutText})
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className="group flex items-center gap-2.5 px-2.5 py-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-lg transition-all duration-200"
		>
			<div className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
				<LuPlus className="size-3.5" strokeWidth={STROKE_WIDTH_THICK} />
			</div>
			<span className="flex-1 text-left">New Node</span>
			<span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity font-mono tabular-nums shrink-0 bg-muted/30 px-1.5 py-0.5 rounded">
				{shortcutText}
			</span>
		</button>
	);
}
