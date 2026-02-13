import { cn } from "ui/lib/utils";
import { AgentRow } from "./AgentRow";
import type { AgentCardData, LaneStatus } from "./types";

interface StatusLaneProps {
	title: string;
	status: LaneStatus;
	agents: AgentCardData[];
	emptyText: string;
	onAgentSelect: (nodeId: string, paneId: string, tabId: string) => void;
}

const LANE_HEADER_COLORS: Record<LaneStatus, string> = {
	running: "text-[var(--status-info)]",
	waiting: "text-[var(--status-warning)]",
	completed: "text-[var(--status-running)]",
	idle: "text-muted-foreground/50",
};

export function StatusLane({ title, status, agents, emptyText, onAgentSelect }: StatusLaneProps) {
	return (
		<div className="flex flex-col flex-1 min-w-[220px] px-4 py-4">
			{/* Lane header */}
			<div className="flex items-center gap-2 py-1.5 mb-2">
				<span
					className={cn(
						"text-caption font-medium uppercase tracking-wider",
						LANE_HEADER_COLORS[status],
					)}
				>
					{title}
				</span>
				<span className="text-caption text-muted-foreground/40">{agents.length}</span>
			</div>

			{/* Agents list */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{agents.length === 0 ? (
					<div className="text-caption text-muted-foreground/40 py-4">{emptyText}</div>
				) : (
					<div className="space-y-2">
						{agents.map((agent) => (
							<AgentRow
								key={`${agent.nodeId}-${agent.paneId}`}
								agent={agent}
								onSelect={() => onAgentSelect(agent.nodeId, agent.paneId, agent.tabId)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
