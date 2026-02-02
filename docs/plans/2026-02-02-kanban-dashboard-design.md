# Kanban Agent Dashboard Design

**Date:** 2026-02-02
**Status:** Approved
**Goal:** Multi-agent orchestration dashboard for managing multiple AI coding agents at a glance

## Overview

A Kanban-style status view in the right pane that shows all agents/nodes organized by their current status. Optimized for developers managing multiple agents across different repos/branches simultaneously.

## Information Priority

1. **Agent status** (most important) - Which agents are running, waiting, idle, or errored
2. **Activity feed** - What each agent is currently doing
3. **Git state** - Branch status, uncommitted changes

## Layout Structure

### Toggle Placement

A "Tree View" button placed directly above the "Nodes" header in the right sidebar:

```
┌─────────────────────────────────┐
│     [Tree View]                 │  ← button to open Kanban
├─────────────────────────────────┤
│  ⚡ Nodes                       │  ← existing header
│  + New Node                     │
│  ...                            │
└─────────────────────────────────┘
```

**Behavior:**
- Click "Tree View" → opens Kanban dashboard in **main content area** (like a file/terminal tab)
- Right sidebar (Nodes list) remains visible alongside
- Kanban tab can be closed like any other tab
- Can have terminal tabs + Kanban tab open simultaneously

### Full Layout

```
┌───────────────────────────────────────────────────────────┐
│  Main Content Area                      │  Right Sidebar  │
│  ┌───────────────────────────────────┐  │  ┌───────────┐  │
│  │ RUNNING (2) │ WAITING (1) │ IDLE  │  │  │[Tree View]│  │
│  │ ─────────── │ ─────────── │ ───── │  │  ├───────────┤  │
│  │ ┌─────────┐ │ ┌─────────┐ │┌────┐ │  │  │ Nodes     │  │
│  │ │ Agent1  │ │ │ Agent3  │ ││ ✓  │ │  │  │ + New     │  │
│  │ │ repo-a  │ │ │ repo-b  │ │└────┘ │  │  │ repo-a    │  │
│  │ │ 12m 🔵  │ │ │ 3m  🟡  │ │┌────┐ │  │  │  └─node1  │  │
│  │ └─────────┘ │ └─────────┘ ││ ⚫  │ │  │  │  └─node2  │  │
│  │ ┌─────────┐ │             │└────┘ │  │  │ repo-b    │  │
│  │ │ Agent2  │ │             │┌────┐ │  │  │  └─node3  │  │
│  │ │ repo-a  │ │             ││ 🔴  │ │  │  └───────────┘  │
│  │ │ 5m  🔵  │ │             │└────┘ │  │                  │
│  │ └─────────┘ │             │      │  │                  │
│  └───────────────────────────────────┘  │                  │
└───────────────────────────────────────────────────────────┘
```

### Kanban Board Layout

Three columns organized by agent status (displayed in main content area):

### Column Definitions

| Column | Description | Indicator |
|--------|-------------|-----------|
| **Running** | Agents actively executing | 🔵 Animated spinner/pulse |
| **Waiting** | Agents waiting for user input | 🟡 Static yellow dot |
| **Idle** | Agents not running (see substates below) | Various |

### Idle Column Substates

The Idle column displays three visual states:

| State | Condition | Visual |
|-------|-----------|--------|
| **Completed** | Finished successfully, viewed within last 2 sessions | ✓ Green checkmark |
| **Idle** | Stale completed (>2 sessions unviewed) or manually stopped | ⚫ Gray dot, muted styling |
| **Error** | Failed with error | 🔴 Red dot + red border |

**State Lifecycle:**
```
Running → Completed → (after 2 sessions unviewed) → Idle
       → Error (if failed)
       → Idle (if manually stopped)
```

## Card Design

### Collapsed State (Default)

```
┌─────────────────────────────┐
│ ● TCP-Server-Boilerplate    │  ← repo color dot + node name
│   backend-revamp            │  ← branch/subtitle
│   ⏱ 12m                 🔵  │  ← time + status indicator
└─────────────────────────────┘
```

**Card content:**
- Repository name with color dot
- Node/branch name
- Time info (duration if running, "ago" if idle)
- Status indicator (spinner, dot, checkmark, error badge)

### Expanded State (On Click)

```
┌──────────────────────────────┐
│ ● repo-name / node-name      │
│   Running for 12m            │
├──────────────────────────────┤
│ Activity                     │
│ ├─ Editing src/auth.ts       │
│ ├─ Running tests...          │
│ └─ 3 files modified          │
├──────────────────────────────┤
│ Git                          │
│   main ← feature-auth        │
│   +145 -23 · 3 files         │
├──────────────────────────────┤
│ [View in Terminal]           │
└──────────────────────────────┘
```

**Expanded sections:**
- **Activity** - Last 2-3 actions (files edited, commands run)
- **Git** - Branch info, diff summary (+/- lines, file count)
- **Action button** - "View in Terminal" to jump to agent's session

## Interactions

| Action | Result |
|--------|--------|
| Click card | Expand inline to show details |
| Double-click card | Focus main pane on that agent's terminal |
| Click "View in Terminal" | Same as double-click (explicit action) |
| Click elsewhere / card header | Collapse expanded card |

**Constraints:**
- Only one card expanded at a time
- Clicking another card collapses the previously expanded one

## Visual Styling

### Status Indicators

| Status | Indicator | Color |
|--------|-----------|-------|
| Running | Animated spinner or pulse | Blue |
| Waiting | Static dot or bell icon | Yellow |
| Completed | Checkmark | Green |
| Idle | Muted dot | Gray |
| Error | Dot + card border | Red |

### Column Headers

```
RUNNING (2)    WAITING (1)    IDLE (3)
```
- Count badge shows number of agents in each column
- Headers remain visible when scrolling

### Transitions

- Cards animate smoothly when moving between columns
- Expand/collapse with subtle height animation
- Crossfade or slide transition when toggling between Nodes/Tree View

### Responsive Behavior

- When right pane is narrow: columns scroll horizontally
- Column headers stay sticky

## Data Requirements

### Card Data (from existing node/workspace model)

- `id` - Node identifier
- `name` - Node name
- `repositoryId` - Parent repository
- `repository.name` - Repository display name
- `repository.color` - Repository color dot
- `branch` - Git branch name
- `createdAt` / `updatedAt` - For time calculations

### Status Detection (new logic needed)

Determine agent status by monitoring terminal/session state:

| Status | Detection Logic |
|--------|-----------------|
| Running | Active terminal session with ongoing process |
| Waiting | Terminal showing prompt, awaiting input |
| Completed | Process exited successfully (exit code 0) |
| Error | Process exited with error (exit code != 0) |
| Idle | No active session or manually stopped |

### Activity Feed (from terminal/agent hooks)

- Recent commands executed
- Files modified (from git status)
- Current action (parsing terminal output)

## Scope

### In Scope

- Tree View toggle button above Nodes header
- Kanban status view with 3 columns
- Agent cards with collapsed/expanded states
- Click to expand, double-click to focus terminal
- Status detection (Running/Waiting/Idle/Completed/Error)
- Activity feed in expanded card
- Git summary in expanded card

### Out of Scope (Future)

- Subagent nesting (no parent-child tracking exists currently)
- Drag-and-drop between columns
- Filtering/search within Kanban
- Custom column configuration
- Notifications/alerts for status changes

## Implementation Notes

### Files to Create/Modify

**New Components:**
- `src/renderer/screens/main/components/NodeView/TreeView/` - Kanban dashboard view (main content)
- `src/renderer/screens/main/components/NodeView/TreeView/TreeView.tsx` - Main Kanban container
- `src/renderer/screens/main/components/NodeView/TreeView/AgentCard.tsx` - Card component
- `src/renderer/screens/main/components/NodeView/TreeView/StatusColumn.tsx` - Column component

**Modify:**
- `src/renderer/screens/main/components/NodeSidebar/NodeSidebarHeader/` - Add Tree View button
- `src/renderer/stores/tabs/` - Support opening Kanban as a special tab type

**New Store/State:**
- Agent status tracking (may need new store or extend existing)
- Session-based "viewed" tracking for completed→idle transition

### Status Detection Approach

Hook into existing terminal/session infrastructure:
- Monitor `terminal.onData` for activity
- Track process exit codes
- Parse prompt patterns to detect "waiting for input"
