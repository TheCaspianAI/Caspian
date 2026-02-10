# Worktree directory manually deleted not detected

## Scenario

User deletes a worktree directory from Finder or terminal. The database still references it.

## Current Behavior

The node appears normal in the sidebar. When the user interacts with it (opens terminal, views changes), operations fail because the path doesn't exist. During node deletion, `worktreeExists()` detects the missing directory and skips git cleanup, so deletion works. But general usage doesn't handle this gracefully.

## What's Missing

- Startup validation that all worktree paths still exist on disk
- A "broken worktree" indicator if the path is gone
- Options to re-create the worktree or remove the node

## Key Files

- `src/lib/trpc/routers/nodes/utils/git.ts` — `worktreeExists()` checks path existence
- `src/lib/trpc/routers/nodes/procedures/delete.ts` — handles missing worktree during deletion
- `src/main/index.ts` — app startup (no worktree validation)

## Impact

Medium — the node appears functional in the sidebar but every interaction fails. User must figure out what happened on their own.
