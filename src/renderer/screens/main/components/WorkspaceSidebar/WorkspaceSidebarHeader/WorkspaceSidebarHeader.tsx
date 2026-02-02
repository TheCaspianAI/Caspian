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
		<div className="flex flex-col gap-1 border-b border-border px-2 pt-2 pb-2">
			<button
				type="button"
				onClick={handleWorkspacesClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isWorkspacesListOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Workspaces</span>
			</button>

			<NewWorkspaceButton />
		</div>
	);
}
