# Create node from merged/closed PR gives confusing error

## Scenario

User pastes a PR URL for a PR that has already been merged and its branch deleted.

## Current Behavior

`getPrInfo()` via `gh pr view` succeeds because merged PRs are still viewable. But `fetchPrBranch()` fails because the branch no longer exists on the remote. The error message is not specific to this case — it's a generic fetch failure.

## What's Missing

- Check `pr.state` before attempting to create a worktree
- If the PR is merged or closed, warn the user that the branch may not exist
- Offer alternatives: check out at the merge commit, or skip if the branch is gone

## Key Files

- `src/lib/trpc/routers/nodes/procedures/create.ts` — `createFromPr` flow
- `src/lib/trpc/routers/nodes/utils/git.ts` — `getPrInfo()`, `fetchPrBranch()`

## Impact

Medium — users get a confusing error when trying to open an already-merged PR. The fix is straightforward (check PR state first).
