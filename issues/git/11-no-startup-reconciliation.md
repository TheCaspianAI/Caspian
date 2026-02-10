# No startup reconciliation of git state

## Scenario

App starts up with nodes from a previous session. The underlying git state may have changed while the app was closed (branches deleted, worktrees removed, repos moved).

## Current Behavior

Nodes are loaded from the database as-is. Terminal daemon sessions are reconciled (`reconcileDaemonSessions`). No other validation occurs. Stale state persists until the user encounters an error.

## What's Missing

- A lightweight startup pass that verifies:
  - Worktree paths exist on disk
  - Repository paths are accessible
  - Branches are still valid (at minimum, checked-out branch matches `node.branch`)
- Flagging clearly broken nodes rather than running expensive git operations
- This does not need to be blocking — it can run in the background after the UI loads

## Key Files

- `src/main/index.ts` — app startup, calls `initAppState()` and `reconcileDaemonSessions()`
- `src/lib/trpc/routers/nodes/utils/git.ts` — `worktreeExists()`, `getCurrentBranch()`

## Impact

Medium — stale state accumulates silently. Users discover problems reactively through errors rather than proactively through indicators.
