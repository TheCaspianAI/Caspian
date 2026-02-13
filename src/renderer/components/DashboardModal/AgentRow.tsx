import { cn } from "ui/lib/utils";
import type { AgentCardData, AgentStatus } from "./types";

interface AgentRowProps {
	agent: AgentCardData;
	onSelect: () => void;
}

const STATUS_DOT_COLORS: Record<AgentStatus, string> = {
	running: "bg-[var(--status-info)]",
	waiting: "bg-[var(--status-warning)]",
	completed: "bg-[var(--status-running)]",
	idle: "bg-muted-foreground/50",
	error: "bg-[var(--status-error)]",
};

export function AgentRow({ agent, onSelect }: AgentRowProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full rounded-lg p-3",
				"bg-background border border-border",
				"text-left transition-colors duration-[80ms]",
				"hover:border-foreground/15 hover:bg-foreground/[0.04]",
				"focus:outline-none focus-visible:border-foreground/20",
			)}
		>
			{/* Status dot + Agent name */}
			<div className="flex items-center gap-2">
				<div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[agent.status])} />
				<span className="text-body font-medium truncate">{agent.agentName}</span>
			</div>

			{/* Branch · Repository */}
			<div className="text-caption text-muted-foreground/70 truncate mt-1 ml-4">
				<span>{agent.nodeName}</span>
				<span className="mx-1 opacity-50">·</span>
				<span>{agent.repositoryName}</span>
			</div>

			{/* Duration */}
			{agent.duration && (
				<div className="text-caption text-muted-foreground/60 text-right mt-1 tabular-nums">
					{agent.duration}
				</div>
			)}
		</button>
	);
}
