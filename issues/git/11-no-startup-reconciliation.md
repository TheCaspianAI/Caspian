# No startup reconciliation of git state

## Scenario

App starts up with nodes from a previous session. The underlying git state may have changed while the app was closed (branches deleted, worktrees removed, repos moved).

## Current Behavior

Nodes are loaded from the database as-is. Terminal daemon sessions are reconciled (`reconcileDaemonSessions`). No other validation occurs at startup.

On-demand detection now exists: when a user views a node, `nodes.get` checks if the repository path and worktree path still exist on disk, rendering `RepositoryMissingView` or `WorktreeMissingView` with recovery options. Branch renames are also detected and auto-corrected during status refresh. However, these checks only run when the node is selected — other nodes in the NodesListView and NodeSwitcherModal can appear normal until the user actually opens them.

## What's Missing

- A lightweight startup pass that verifies all nodes in the background (worktree paths exist, repository paths accessible, branches valid) — rather than waiting until the user selects each node
- Flagging broken nodes in the NodesListView and NodeSwitcherModal so users see problems immediately, not only after opening the node
- This does not need to be blocking — it can run in the background after the UI loads

## Key Files

- `src/main/index.ts` — app startup, calls `initAppState()` and `reconcileDaemonSessions()`
- `src/lib/trpc/routers/nodes/utils/git.ts` — `worktreeExists()`, `getCurrentBranch()`

## Impact

Low-Medium — on-demand detection now catches problems when a node is viewed, but other nodes remain unchecked until selected. A background startup pass would surface all issues immediately.
