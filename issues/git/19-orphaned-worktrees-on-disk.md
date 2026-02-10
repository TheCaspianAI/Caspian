# Orphaned worktrees on disk not cleaned up

## Scenario

Node deletion fails halfway, the database is reset, or a crash leaves partial state. Worktree directories under `~/.caspian/worktrees/` remain on disk with no corresponding database record.

## Current Behavior

No detection or cleanup mechanism exists. The directories consume disk space silently. There is no way to discover or remove them from within Caspian.

## What's Missing

- A scan of `~/.caspian/worktrees/` against database records to find orphaned directories
- An option to clean up orphaned worktrees (either automatically or via a settings/maintenance action)

## Key Files

- `src/lib/trpc/routers/nodes/procedures/create.ts` — constructs worktree paths under `~/.caspian/worktrees/`
- `src/lib/trpc/routers/nodes/procedures/delete.ts` — worktree cleanup during deletion
- `src/lib/trpc/routers/nodes/utils/node-init.ts` — partial cleanup on init failure

## Impact

Low — primarily a disk space concern. Does not affect app functionality, but could accumulate significantly for power users who create and delete many nodes.
