export type AgentStatus = "running" | "waiting" | "completed" | "idle" | "error";
export type ColumnStatus = "running" | "waiting" | "idle";

export interface AgentCardData {
  nodeId: string;
  nodeName: string;
  paneId: string;
  tabId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryColor: string;
  branch: string;
  status: AgentStatus;
  duration?: string;
  activity?: string[];
  gitInfo?: {
    baseBranch: string;
    diffStats?: {
      additions: number;
      deletions: number;
      filesChanged: number;
    };
  };
}
