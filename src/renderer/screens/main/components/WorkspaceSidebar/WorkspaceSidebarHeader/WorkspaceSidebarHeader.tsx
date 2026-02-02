import { Tooltip, TooltipContent, TooltipTrigger } from "ui/components/ui/tooltip";
import { cn } from "ui/lib/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LuLayers } from "react-icons/lu";
import { STROKE_WIDTH } from "../constants";
import { NewWorkspaceButton } from "./NewWorkspaceButton";

interface WorkspaceSidebarHeaderProps {
	isCollapsed?: boolean;
}

export function WorkspaceSidebarHeader({
	isCollapsed = false,
}: WorkspaceSidebarHeaderProps) {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();

	// Derive active state from route
	const isWorkspacesListOpen = !!matchRoute({ to: "/workspaces" });

	const handleWorkspacesClick = () => {
		if (isWorkspacesListOpen) {
			// Navigate back to workspace view
			navigate({ to: "/workspace" });
		} else {
			navigate({ to: "/workspaces" });
		}
	};

	if (isCollapsed) {
		return (
			<div className="flex flex-col items-center border-b border-border py-2 gap-2">
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleWorkspacesClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isWorkspacesListOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">Workspaces</TooltipContent>
				</Tooltip>

				<NewWorkspaceButton isCollapsed />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 border-b border-border/50 px-2.5 pt-3 pb-2.5">
			<button
				type="button"
				onClick={handleWorkspacesClick}
				className={cn(
					"group flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg transition-all duration-200",
					isWorkspacesListOpen
						? "text-foreground bg-accent/80 shadow-sm"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/40",
				)}
			>
				<div className={cn(
					"flex items-center justify-center size-6 rounded-md transition-colors",
					isWorkspacesListOpen
						? "bg-primary/15 text-primary"
						: "bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary",
				)}>
					<LuLayers className="size-3.5" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Workspaces</span>
			</button>

			<NewWorkspaceButton />
		</div>
	);
}
