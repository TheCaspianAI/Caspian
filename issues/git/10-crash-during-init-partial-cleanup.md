# Partial worktree cleanup after crash during initialization

## Scenario

The app crashes or is force-quit while a node is being initialized (worktree creation in progress).

## Current Behavior

The `NodeInitManager` tracks state in memory only (documented limitation at `node-init-manager.ts:18-20`). On restart, the node exists in the database but its initialization state is lost. The UI shows "Setup incomplete" with retry/delete options, which is well-handled. However, partially-created worktree directories on disk are not cleaned up.

## What's Missing

- Cleanup of partially-created worktree directories left on disk after a crash
- Startup check for nodes stuck in an initializing-like state with incomplete worktrees

## Key Files

- `src/main/lib/node-init-manager.ts` — in-memory state machine, documents the limitation
- `src/lib/trpc/routers/nodes/utils/node-init.ts` — initialization flow with cleanup on failure (but not on crash)

## Impact

Low — the retry/delete UI handles the user-facing side. The gap is only orphaned directories on disk consuming space.
