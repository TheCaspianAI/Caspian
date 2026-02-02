import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LuLayers, LuPanelRight, LuPanelRightClose, LuPanelRightOpen } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { useNodeSidebarStore } from "renderer/stores/node-sidebar-state";
import { STROKE_WIDTH } from "../constants";
import { NewNodeButton } from "./NewNodeButton";

interface NodeSidebarHeaderProps {
	isCollapsed?: boolean;
}

export function NodeSidebarHeader({
	isCollapsed = false,
}: NodeSidebarHeaderProps) {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { toggleCollapsed } = useNodeSidebarStore();

	// Derive active state from route
	const isNodesListOpen = !!matchRoute({ to: "/workspaces" });

	const handleNodesClick = () => {
		if (isNodesListOpen) {
			// Navigate back to node view
			navigate({ to: "/workspace" });
		} else {
			navigate({ to: "/workspaces" });
		}
	};

	const getToggleIcon = (isHovering: boolean) => {
		if (isCollapsed) {
			return isHovering ? (
				<LuPanelRightClose className="size-4" strokeWidth={1.5} />
			) : (
				<LuPanelRight className="size-4" strokeWidth={1.5} />
			);
		}
		return isHovering ? (
			<LuPanelRightOpen className="size-4" strokeWidth={1.5} />
		) : (
			<LuPanelRight className="size-4" strokeWidth={1.5} />
		);
	};

	if (isCollapsed) {
		return (
			<div className="flex flex-col items-center border-b border-border py-2 gap-2">
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={toggleCollapsed}
							className="group flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
						>
							<span className="group-hover:hidden">{getToggleIcon(false)}</span>
							<span className="hidden group-hover:block">{getToggleIcon(true)}</span>
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">
						<HotkeyTooltipContent
							label="Expand sidebar"
							hotkeyId="TOGGLE_NODE_SIDEBAR"
						/>
					</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleNodesClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isNodesListOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">Nodes</TooltipContent>
				</Tooltip>

				<NewNodeButton isCollapsed />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 border-b border-border/50 px-2.5 pt-3 pb-2.5">
			<button
				type="button"
				onClick={handleNodesClick}
				className={cn(
					"group flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg transition-all duration-200",
					isNodesListOpen
						? "text-foreground bg-accent/80 shadow-sm"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/40",
				)}
			>
				<div className={cn(
					"flex items-center justify-center size-6 rounded-md transition-colors",
					isNodesListOpen
						? "bg-primary/15 text-primary"
						: "bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary",
				)}>
					<LuLayers className="size-3.5" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Nodes</span>
			</button>

			<NewNodeButton />
		</div>
	);
}
