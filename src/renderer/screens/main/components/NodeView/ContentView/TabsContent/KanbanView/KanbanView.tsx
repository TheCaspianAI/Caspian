import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import { StatusColumn } from "./StatusColumn";
import { useKanbanData } from "./useKanbanData";

export function KanbanView() {
  const navigate = useNavigate();
  const { columns } = useKanbanData();
  const { setActiveTab, setFocusedPane, tabs } = useTabsStore((s) => ({
    setActiveTab: s.setActiveTab,
    setFocusedPane: s.setFocusedPane,
    tabs: s.tabs,
  }));

  const handleAgentDoubleClick = useCallback(
    (nodeId: string) => {
      // Navigate to the node's workspace
      navigate({ to: "/workspace/$workspaceId", params: { workspaceId: nodeId } });
    },
    [navigate]
  );

  const handleViewInTerminal = useCallback(
    (nodeId: string, targetPaneId: string) => {
      if (!targetPaneId) {
        // No pane, just navigate to node
        navigate({ to: "/workspace/$workspaceId", params: { workspaceId: nodeId } });
        return;
      }

      // Find the tab containing this pane
      const targetTab = tabs.find((t) => t.nodeId === nodeId);
      if (targetTab) {
        // Navigate to node
        navigate({ to: "/workspace/$workspaceId", params: { workspaceId: nodeId } });
        // Activate the tab and focus the pane
        setActiveTab(nodeId, targetTab.id);
        setFocusedPane(targetTab.id, targetPaneId);
      }
    },
    [navigate, tabs, setActiveTab, setFocusedPane]
  );

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Agent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitor all agents across your repositories
        </p>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max p-4 gap-4">
          <StatusColumn
            title="Running"
            status="running"
            agents={columns.running}
            onAgentDoubleClick={handleAgentDoubleClick}
            onViewInTerminal={handleViewInTerminal}
          />
          <StatusColumn
            title="Waiting"
            status="waiting"
            agents={columns.waiting}
            onAgentDoubleClick={handleAgentDoubleClick}
            onViewInTerminal={handleViewInTerminal}
          />
          <StatusColumn
            title="Idle"
            status="idle"
            agents={columns.idle}
            onAgentDoubleClick={handleAgentDoubleClick}
            onViewInTerminal={handleViewInTerminal}
          />
        </div>
      </div>
    </div>
  );
}
