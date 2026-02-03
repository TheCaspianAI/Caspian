import { cn } from "ui/lib/utils";
import type { AgentCardData, AgentStatus } from "./types";

interface AgentRowProps {
	agent: AgentCardData;
	onSelect: () => void;
}

const STATUS_INDICATORS: Record<AgentStatus, { color: string; animate: boolean }> = {
	running: { color: "bg-blue-500", animate: true },
	waiting: { color: "bg-yellow-500", animate: false },
	completed: { color: "bg-green-500", animate: false },
	idle: { color: "bg-muted-foreground/50", animate: false },
	error: { color: "bg-red-500", animate: false },
};

export function AgentRow({ agent, onSelect }: AgentRowProps) {
	const indicator = STATUS_INDICATORS[agent.status];

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-sm",
				"text-left transition-colors",
				"hover:bg-muted/40",
				"focus:outline-none focus-visible:bg-muted/60",
				agent.status === "error" && "bg-red-500/5"
			)}
		>
			{/* Status indicator - primary visual element */}
			<div
				className={cn(
					"w-1.5 h-1.5 rounded-full shrink-0",
					indicator.color,
					indicator.animate && "animate-pulse"
				)}
			/>

			{/* Agent info */}
			<div className="flex-1 min-w-0">
				<div className="text-body truncate">{agent.agentName}</div>
				<div className="text-caption text-muted-foreground/70 truncate">
					<span>{agent.nodeName}</span>
					<span className="mx-1 opacity-50">·</span>
					<span>{agent.repositoryName}</span>
				</div>
			</div>

			{/* Duration (for running agents) */}
			{agent.duration && (
				<span className="text-caption text-muted-foreground/60 shrink-0 tabular-nums">
					{agent.duration}
				</span>
			)}
		</button>
	);
}
