# Kanban Agent Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Kanban-style status view in the main content area that shows all agents/nodes organized by their current status (Running | Waiting | Idle).

**Architecture:** The Kanban dashboard opens as a special tab type in the main content area (like terminal/file-viewer tabs). A "Tree View" button in the right sidebar header triggers opening this tab. Status is derived from existing pane status tracking (PaneStatus: working → Running, permission → Waiting, idle/review → Idle column with substates).

**Tech Stack:** React, Zustand (tabs store), TanStack Router, Tailwind CSS, Lucide React icons

---

## Task 1: Add "kanban" PaneType to shared types

**Files:**
- Modify: `src/shared/tabs-types.ts:11`

**Step 1: Add kanban to PaneType union**

```typescript
// Change from:
export type PaneType = "terminal" | "webview" | "file-viewer";

// To:
export type PaneType = "terminal" | "webview" | "file-viewer" | "kanban";
```

**Step 2: Verify no type errors**

Run: `cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

**Step 3: Commit**

```bash
git add src/shared/tabs-types.ts
git commit -m "feat(kanban): add kanban pane type"
```

---

## Task 2: Add utility to create kanban pane in tabs store

**Files:**
- Modify: `src/renderer/stores/tabs/utils/index.ts` (or create-pane utilities)

**Step 1: Find and read the pane creation utilities**

Locate `createPane` and `createFileViewerPane` functions in the tabs utils.

**Step 2: Add createKanbanPane function**

```typescript
export function createKanbanPane(tabId: string): Pane {
  return {
    id: generateId("pane"),
    tabId,
    type: "kanban",
    name: "Agent Dashboard",
    isNew: false,
  };
}
```

**Step 3: Export the function**

Ensure it's exported from the utils index.

**Step 4: Commit**

```bash
git add src/renderer/stores/tabs/utils/
git commit -m "feat(kanban): add createKanbanPane utility"
```

---

## Task 3: Add openKanbanDashboard action to tabs store

**Files:**
- Modify: `src/renderer/stores/tabs/types.ts`
- Modify: `src/renderer/stores/tabs/store.ts`

**Step 1: Add action type to TabsStore interface**

In `src/renderer/stores/tabs/types.ts`, add to TabsStore interface:

```typescript
/** Opens the Kanban dashboard as a tab in the specified node */
openKanbanDashboard: (nodeId: string) => { tabId: string; paneId: string };
```

**Step 2: Implement the action in store**

In `src/renderer/stores/tabs/store.ts`, add:

```typescript
openKanbanDashboard: (nodeId: string) => {
  const state = get();

  // Check if kanban tab already exists for this node
  const existingTab = state.tabs.find(
    (t) => t.nodeId === nodeId &&
    Object.values(state.panes).some(
      (p) => p.tabId === t.id && p.type === "kanban"
    )
  );

  if (existingTab) {
    // Activate existing tab
    const kanbanPane = Object.values(state.panes).find(
      (p) => p.tabId === existingTab.id && p.type === "kanban"
    );
    set({
      activeTabIds: {
        ...state.activeTabIds,
        [nodeId]: existingTab.id,
      },
    });
    return { tabId: existingTab.id, paneId: kanbanPane?.id ?? "" };
  }

  // Create new kanban tab
  const tabId = generateId("tab");
  const pane = createKanbanPane(tabId);
  const nodeTabs = state.tabs.filter((t) => t.nodeId === nodeId);

  const tab: Tab = {
    id: tabId,
    name: "Agent Dashboard",
    nodeId,
    layout: pane.id,
    createdAt: Date.now(),
  };

  const currentActiveId = state.activeTabIds[nodeId];
  const historyStack = state.tabHistoryStacks[nodeId] || [];
  const newHistoryStack = currentActiveId
    ? [currentActiveId, ...historyStack.filter((id) => id !== currentActiveId)]
    : historyStack;

  set({
    tabs: [...state.tabs, tab],
    panes: { ...state.panes, [pane.id]: pane },
    activeTabIds: {
      ...state.activeTabIds,
      [nodeId]: tab.id,
    },
    focusedPaneIds: {
      ...state.focusedPaneIds,
      [tab.id]: pane.id,
    },
    tabHistoryStacks: {
      ...state.tabHistoryStacks,
      [nodeId]: newHistoryStack,
    },
  });

  return { tabId: tab.id, paneId: pane.id };
},
```

**Step 3: Import createKanbanPane**

Add import at top of store.ts:
```typescript
import { createKanbanPane } from "./utils";
```

**Step 4: Verify types**

Run: `cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/renderer/stores/tabs/
git commit -m "feat(kanban): add openKanbanDashboard action to tabs store"
```

---

## Task 4: Create AgentCard component

**Files:**
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/AgentCard.tsx`

**Step 1: Create the directory**

```bash
mkdir -p src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView
```

**Step 2: Write AgentCard component**

```typescript
import { useState } from "react";
import { cn } from "ui/lib/utils";
import { LuChevronDown, LuChevronRight, LuTerminal } from "react-icons/lu";
import type { AgentCardData, AgentStatus } from "./types";

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

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-all cursor-pointer",
        "hover:border-primary/50",
        agent.status === "error" && "border-red-500/50",
        isExpanded && "shadow-md"
      )}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Collapsed State */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: agent.repositoryColor }}
          />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{agent.nodeName}</div>
            <div className="text-xs text-muted-foreground truncate">
              {agent.branch}
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
                {agent.activity.slice(0, 3).map((action, i) => (
                  <div key={i} className="text-xs text-foreground/80 truncate">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Git Section */}
          {agent.gitInfo && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Git
              </div>
              <div className="text-xs text-foreground/80">
                {agent.gitInfo.baseBranch} ← {agent.branch}
              </div>
              {agent.gitInfo.diffStats && (
                <div className="text-xs text-muted-foreground">
                  <span className="text-green-500">+{agent.gitInfo.diffStats.additions}</span>
                  {" "}
                  <span className="text-red-500">-{agent.gitInfo.diffStats.deletions}</span>
                  {" · "}
                  {agent.gitInfo.diffStats.filesChanged} files
                </div>
              )}
            </div>
          )}

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
```

**Step 3: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/
git commit -m "feat(kanban): create AgentCard component"
```

---

## Task 5: Create StatusColumn component

**Files:**
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/StatusColumn.tsx`

**Step 1: Write StatusColumn component**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/
git commit -m "feat(kanban): create StatusColumn component"
```

---

## Task 6: Create Kanban types

**Files:**
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/types.ts`

**Step 1: Write types file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/
git commit -m "feat(kanban): create Kanban types"
```

---

## Task 7: Create useKanbanData hook

**Files:**
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/useKanbanData.ts`

**Step 1: Write the hook**

```typescript
import { useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { PaneStatus } from "shared/tabs-types";
import type { AgentCardData, AgentStatus, ColumnStatus } from "./types";

function mapPaneStatusToAgentStatus(paneStatus: PaneStatus | undefined): AgentStatus {
  switch (paneStatus) {
    case "working":
      return "running";
    case "permission":
      return "waiting";
    case "review":
      return "completed";
    case "idle":
    default:
      return "idle";
  }
}

function formatDuration(startTime: number): string {
  const now = Date.now();
  const diffMs = now - startTime;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "< 1m";
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

export function useKanbanData() {
  const { data: groupedData } = electronTrpc.nodes.getAllGrouped.useQuery();
  const panes = useTabsStore((s) => s.panes);
  const tabs = useTabsStore((s) => s.tabs);

  const agents = useMemo<AgentCardData[]>(() => {
    if (!groupedData) return [];

    const result: AgentCardData[] = [];

    for (const group of groupedData) {
      for (const node of group.nodes) {
        // Find panes for this node
        const nodeTabs = tabs.filter((t) => t.nodeId === node.id);
        const nodePaneIds = nodeTabs.flatMap((t) =>
          Object.values(panes)
            .filter((p) => p.tabId === t.id && p.type === "terminal")
            .map((p) => p.id)
        );

        // Get highest priority status from all panes
        let highestStatus: PaneStatus = "idle";
        let activePaneId = "";
        let activeTabId = "";

        for (const paneId of nodePaneIds) {
          const pane = panes[paneId];
          if (!pane) continue;

          const paneStatus = pane.status ?? "idle";
          // Priority: permission > working > review > idle
          if (paneStatus === "permission" ||
              (paneStatus === "working" && highestStatus !== "permission") ||
              (paneStatus === "review" && highestStatus === "idle")) {
            highestStatus = paneStatus;
            activePaneId = paneId;
            activeTabId = pane.tabId;
          } else if (!activePaneId && paneStatus === "idle") {
            activePaneId = paneId;
            activeTabId = pane.tabId;
          }
        }

        // Skip nodes with no terminal panes
        if (!activePaneId) {
          // Still show the node but without pane reference
          result.push({
            nodeId: node.id,
            nodeName: node.name,
            paneId: "",
            tabId: "",
            repositoryId: group.repository.id,
            repositoryName: group.repository.name,
            repositoryColor: group.repository.color,
            branch: node.branch,
            status: "idle",
          });
          continue;
        }

        result.push({
          nodeId: node.id,
          nodeName: node.name,
          paneId: activePaneId,
          tabId: activeTabId,
          repositoryId: group.repository.id,
          repositoryName: group.repository.name,
          repositoryColor: group.repository.color,
          branch: node.branch,
          status: mapPaneStatusToAgentStatus(highestStatus),
          duration: highestStatus === "working" ? formatDuration(node.updatedAt) : undefined,
        });
      }
    }

    return result;
  }, [groupedData, panes, tabs]);

  const columns = useMemo(() => {
    const running = agents.filter((a) => a.status === "running");
    const waiting = agents.filter((a) => a.status === "waiting");
    const idle = agents.filter((a) =>
      a.status === "completed" || a.status === "idle" || a.status === "error"
    );

    return {
      running,
      waiting,
      idle,
    };
  }, [agents]);

  return { agents, columns };
}
```

**Step 2: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/
git commit -m "feat(kanban): create useKanbanData hook"
```

---

## Task 8: Create KanbanView main component

**Files:**
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/KanbanView.tsx`
- Create: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/index.ts`

**Step 1: Write KanbanView component**

```typescript
import { useNavigate } from "@tanstack/react-router";
import { useTabsStore } from "renderer/stores/tabs/store";
import { StatusColumn } from "./StatusColumn";
import { useKanbanData } from "./useKanbanData";

interface KanbanViewProps {
  paneId: string;
  tabId: string;
}

export function KanbanView({ paneId, tabId }: KanbanViewProps) {
  const navigate = useNavigate();
  const { columns } = useKanbanData();
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const setFocusedPane = useTabsStore((s) => s.setFocusedPane);
  const tabs = useTabsStore((s) => s.tabs);

  const handleAgentDoubleClick = (nodeId: string) => {
    // Navigate to the node's workspace
    navigate({ to: "/workspace/$workspaceId", params: { workspaceId: nodeId } });
  };

  const handleViewInTerminal = (nodeId: string, targetPaneId: string) => {
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
  };

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
```

**Step 2: Create index.ts**

```typescript
export { KanbanView } from "./KanbanView";
```

**Step 3: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/
git commit -m "feat(kanban): create KanbanView main component"
```

---

## Task 9: Route kanban pane type in TabView

**Files:**
- Modify: `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/TabView/index.tsx`

**Step 1: Import KanbanView**

Add at top of file:
```typescript
import { KanbanView } from "../KanbanView";
```

**Step 2: Add kanban case in renderPane**

In the `renderPane` callback, add before the default terminal case:

```typescript
// Route kanban panes to KanbanView component
if (paneInfo.type === "kanban") {
  return (
    <KanbanView
      paneId={paneId}
      tabId={tab.id}
    />
  );
}
```

**Step 3: Verify it compiles**

Run: `cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/renderer/screens/main/components/NodeView/ContentView/TabsContent/TabView/
git commit -m "feat(kanban): route kanban pane type in TabView"
```

---

## Task 10: Add Tree View button to NodeSidebarHeader

**Files:**
- Modify: `src/renderer/screens/main/components/NodeSidebar/NodeSidebarHeader/NodeSidebarHeader.tsx`

**Step 1: Import required dependencies**

Add imports:
```typescript
import { LuLayoutGrid } from "react-icons/lu";
import { useTabsStore } from "renderer/stores/tabs/store";
import { useParams } from "@tanstack/react-router";
```

**Step 2: Add Tree View button (expanded state)**

After the existing "Nodes" button and before `<NewNodeButton />`, add:

```typescript
<button
  type="button"
  onClick={() => {
    const nodeId = // get from route params
    if (nodeId) {
      openKanbanDashboard(nodeId);
    }
  }}
  className={cn(
    "group flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg transition-all duration-200",
    "text-muted-foreground hover:text-foreground hover:bg-accent/40",
  )}
>
  <div className={cn(
    "flex items-center justify-center size-6 rounded-md transition-colors",
    "bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary",
  )}>
    <LuLayoutGrid className="size-3.5" strokeWidth={STROKE_WIDTH} />
  </div>
  <span className="text-sm font-medium flex-1 text-left">Tree View</span>
</button>
```

**Step 3: Get nodeId from params and store action**

At component top:
```typescript
const { workspaceId } = useParams({ strict: false });
const openKanbanDashboard = useTabsStore((s) => s.openKanbanDashboard);
```

Update button onClick:
```typescript
onClick={() => {
  if (workspaceId) {
    openKanbanDashboard(workspaceId);
  }
}}
```

**Step 4: Add Tree View button (collapsed state)**

In the collapsed `if (isCollapsed)` block, add after the Nodes tooltip button:

```typescript
<Tooltip delayDuration={300}>
  <TooltipTrigger asChild>
    <button
      type="button"
      onClick={() => {
        if (workspaceId) {
          openKanbanDashboard(workspaceId);
        }
      }}
      className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <LuLayoutGrid className="size-4" strokeWidth={STROKE_WIDTH} />
    </button>
  </TooltipTrigger>
  <TooltipContent side="left">Tree View</TooltipContent>
</Tooltip>
```

**Step 5: Verify it compiles**

Run: `cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/renderer/screens/main/components/NodeSidebar/NodeSidebarHeader/
git commit -m "feat(kanban): add Tree View button to NodeSidebarHeader"
```

---

## Task 11: Manual testing

**Step 1: Build and run the app**

```bash
cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npm run dev
```

**Step 2: Test Tree View button**

1. Open the app
2. Navigate to a node/workspace
3. Click "Tree View" button in right sidebar
4. Verify Kanban dashboard opens as a new tab
5. Verify 3 columns display: Running, Waiting, Idle

**Step 3: Test card interactions**

1. Click on an agent card → should expand
2. Click again → should collapse
3. Double-click → should navigate to that node's terminal

**Step 4: Test status display**

1. Start a Claude Code agent → should appear in Running column
2. Wait for permission prompt → should move to Waiting column
3. Let it complete → should move to Idle column

---

## Task 12: Polish and edge cases

**Files:**
- Various files in KanbanView directory

**Step 1: Handle empty state**

If there are no nodes at all, show helpful message.

**Step 2: Handle tab closing**

Verify closing the Kanban tab works correctly.

**Step 3: Handle node deletion**

Ensure deleted nodes don't appear in Kanban.

**Step 4: Commit final polish**

```bash
git add .
git commit -m "feat(kanban): polish and edge case handling"
```

---

## Summary

This plan implements the Kanban agent dashboard with:

1. **New pane type** (`kanban`) added to the tabs system
2. **Store action** (`openKanbanDashboard`) to create/focus Kanban tabs
3. **KanbanView components**: `AgentCard`, `StatusColumn`, `KanbanView`, `useKanbanData`
4. **Integration**: Tree View button in sidebar, routing in TabView
5. **Status mapping**: Existing `PaneStatus` → Kanban column placement

The implementation reuses the existing:
- Tabs/panes infrastructure for tab management
- PaneStatus tracking for agent status
- Node querying via tRPC
- Navigation patterns
