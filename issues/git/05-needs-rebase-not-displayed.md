# Needs-rebase status computed but not displayed

## Scenario

The default branch (e.g., `main`) has moved ahead. The node's branch is behind and needs rebasing.

## Current Behavior

`checkNeedsRebase()` in `git.ts:827-834` computes whether the branch is behind the default branch and stores `needsRebase: boolean` in `worktree.gitStatus`. The UI never reads or displays this value. The data is computed, stored, then ignored.

## What's Missing

- Sidebar indicator or banner showing "X commits behind main"
- Action to rebase or merge from the UI
- The `needsRebase` field in `gitStatus` should be surfaced somewhere visible

## Key Files

- `src/lib/trpc/routers/nodes/utils/git.ts:827-834` — `checkNeedsRebase()`
- `src/lib/trpc/routers/nodes/procedures/git-status.ts` — refreshes git status
- `src/lib/local-db/schema/zod.ts` — `gitStatusSchema` with `needsRebase` field

## Impact

Medium — users have no visibility into whether their branch is current with the base branch. The information is already being computed but wasted.
