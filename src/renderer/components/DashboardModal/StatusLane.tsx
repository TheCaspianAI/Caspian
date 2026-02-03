import { cn } from "ui/lib/utils";
import { AgentRow } from "./AgentRow";
import type { AgentCardData, ColumnStatus } from "./types";

interface StatusLaneProps {
	title: string;
	status: ColumnStatus;
	agents: AgentCardData[];
	emptyText: string;
	onAgentSelect: (nodeId: string, paneId: string, tabId: string) => void;
}

const LANE_COLORS: Record<ColumnStatus, string> = {
	running: "text-blue-500/70",
	waiting: "text-yellow-500/70",
	completed: "text-green-500/70",
	idle: "text-muted-foreground/50",
};

export function StatusLane({ title, status, agents, emptyText, onAgentSelect }: StatusLaneProps) {
	return (
		<div className="flex flex-col flex-1 min-w-[280px]">
			{/* Lane header */}
			<div className="flex items-center gap-2 px-2 py-1.5 mb-1">
				<span className={cn("text-caption font-medium uppercase tracking-wider", LANE_COLORS[status])}>
					{title}
				</span>
				<span className="text-caption text-muted-foreground/40">
					{agents.length}
				</span>
			</div>

			{/* Agents list */}
			<div className="flex-1 overflow-y-auto">
				{agents.length === 0 ? (
					<div className="text-caption text-muted-foreground/40 py-4 px-2">
						{emptyText}
					</div>
				) : (
					<div className="space-y-px">
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
