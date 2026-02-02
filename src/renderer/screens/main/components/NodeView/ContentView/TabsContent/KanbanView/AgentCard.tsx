import { useState } from "react";
import { cn } from "ui/lib/utils";
import { LuTerminal, LuGitBranch } from "react-icons/lu";
import type { AgentCardData, AgentStatus } from "./types";

const MAX_ACTIVITY_ITEMS = 3;

interface AgentCardProps {
  agent: AgentCardData;
  onDoubleClick: () => void;
  onViewInTerminal: () => void;
}

const STATUS_INDICATORS: Record<AgentStatus, { color: string; animate: boolean }> = {
  running: { color: "bg-blue-500", animate: true },
  waiting: { color: "bg-yellow-500", animate: false },
  completed: { color: "bg-green-500", animate: false },
  idle: { color: "bg-gray-500", animate: false },
  error: { color: "bg-red-500", animate: false },
};

export function AgentCard({ agent, onDoubleClick, onViewInTerminal }: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const indicator = STATUS_INDICATORS[agent.status];

  const handleClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      role="article"
      tabIndex={0}
      aria-expanded={isExpanded}
      className={cn(
        "rounded-lg border bg-card p-3 transition-all cursor-pointer",
        "hover:border-primary/50",
        agent.status === "error" && "border-red-500/50",
        isExpanded && "shadow-md"
      )}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Collapsed State - Agent Name as Primary */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: agent.repositoryColor }}
          />
          <div className="min-w-0">
            {/* Agent/Terminal name as primary */}
            <div className="font-medium text-sm truncate">{agent.agentName}</div>
            {/* Workspace context as secondary */}
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <span>{agent.nodeName}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-mono">{agent.branch}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {agent.duration && (
            <span className="text-xs text-muted-foreground">
              {agent.duration}
            </span>
          )}
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              indicator.color,
              indicator.animate && "animate-pulse"
            )}
          />
        </div>
      </div>

      {/* Expanded State */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Activity Section */}
          {agent.activity && agent.activity.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Activity
              </div>
              <div className="space-y-1">
                {agent.activity.slice(0, MAX_ACTIVITY_ITEMS).map((action, i) => (
                  <div key={`${i}-${action.slice(0, 20)}`} className="text-xs text-foreground/80 truncate">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workspace Context Section */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Workspace
            </div>
            <div className="text-xs text-foreground/80 flex items-center gap-1.5">
              <LuGitBranch className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono">{agent.branch}</span>
              <span className="text-muted-foreground/50">in</span>
              <span>{agent.nodeName}</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewInTerminal();
            }}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <LuTerminal className="w-3 h-3" />
            View in Terminal
          </button>
        </div>
      )}
    </div>
  );
}
