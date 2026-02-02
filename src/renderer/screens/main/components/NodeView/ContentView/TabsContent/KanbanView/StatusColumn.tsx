import { cn } from "ui/lib/utils";
import { AgentCard } from "./AgentCard";
import type { AgentCardData, ColumnStatus } from "./types";

interface StatusColumnProps {
  title: string;
  status: ColumnStatus;
  agents: AgentCardData[];
  onAgentDoubleClick: (nodeId: string) => void;
  onViewInTerminal: (nodeId: string, paneId: string) => void;
}

const COLUMN_COLORS: Record<ColumnStatus, string> = {
  running: "text-blue-500",
  waiting: "text-yellow-500",
  idle: "text-muted-foreground",
};

export function StatusColumn({
  title,
  status,
  agents,
  onAgentDoubleClick,
  onViewInTerminal,
}: StatusColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
        <span className={cn("text-sm font-semibold uppercase tracking-wide", COLUMN_COLORS[status])}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
          {agents.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {agents.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No agents
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.nodeId}
              agent={agent}
              onDoubleClick={() => onAgentDoubleClick(agent.nodeId)}
              onViewInTerminal={() => onViewInTerminal(agent.nodeId, agent.paneId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
