export type AgentStatus = "running" | "waiting" | "completed" | "idle" | "error";
export type ColumnStatus = "running" | "waiting" | "idle";

export interface AgentCardData {
  /** The terminal/agent name (e.g., "npm run dev", "Terminal 1") */
  agentName: string;
  /** The pane ID for navigation */
  paneId: string;
  /** The tab ID for navigation */
  tabId: string;
  /** The node/workspace this agent belongs to */
  nodeId: string;
  /** Node name for context */
  nodeName: string;
  /** Branch name for context */
  branch: string;
  /** Repository info for visual grouping */
  repositoryId: string;
  repositoryName: string;
  repositoryColor: string;
  /** Agent status */
  status: AgentStatus;
  /** Duration for running agents */
  duration?: string;
  /** Recent activity log */
  activity?: string[];
}
