# Branch renamed externally not detected

## Scenario

User renames a branch via the terminal (`git branch -m old new`). The `node.branch` and `worktrees.branch` fields in the database still reference the old name.

## Current Behavior

The node shows the old branch name in the UI. Git operations that reference the old name fail. There is no mechanism to detect or reconcile branch renames.

## What's Missing

- Validation that `node.branch` matches the actual checked-out branch in the worktree (checkable via `git rev-parse --abbrev-ref HEAD` in the worktree path)
- Detection of the mismatch and prompt to update the database record

## Key Files

- `src/lib/trpc/routers/nodes/procedures/branch.ts` — branch switching (only handles explicit switches)
- `src/lib/local-db/schema/schema.ts` — `nodes.branch` and `worktrees.branch` fields

## Impact

Medium — affects users who use the terminal for branch management alongside Caspian's UI.
