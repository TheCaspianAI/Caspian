# Database and git state drift over time

## Scenario

Over time, the database accumulates worktree records, node records, and cached status that no longer match the actual git state on disk.

## Current Behavior

No reconciliation mechanism exists. Dead worktree records persist. Nodes for deleted branches stay visible. Cached `gitStatus` and `githubStatus` fields become arbitrarily stale. The only cleanup happens during explicit user actions (deleting a node) or coincidental code paths (clone detecting a stale repo path).

## What's Missing

- A periodic or on-demand "health check" that validates database state against actual git state
- Flagging inconsistencies (worktree path gone, branch doesn't exist, repo inaccessible)
- Options to clean up or repair flagged items

## Key Files

- `src/lib/local-db/schema/schema.ts` — database tables for nodes, worktrees, repositories
- `src/lib/trpc/routers/nodes/utils/git.ts` — git state query functions
- `src/main/index.ts` — app startup (no reconciliation)

## Impact

Medium — inconsistencies accumulate silently. Individual issues are low-severity, but the aggregate effect degrades the user experience over time.
