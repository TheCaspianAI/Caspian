# Detached HEAD state not detected

## Scenario

User checks out a specific commit via terminal, or a git operation leaves the worktree in detached HEAD.

## Current Behavior

`git rev-parse --abbrev-ref HEAD` returns `HEAD` instead of a branch name. The node continues showing whatever branch name is stored in the database. Git operations that assume a branch (push, pull, sync) fail with confusing errors.

## What's Missing

- Detection of detached HEAD state when refreshing git status
- Warning indicator in the UI showing the node is in detached HEAD
- Recovery options: create a new branch from current HEAD, or checkout an existing branch

## Key Files

- `src/lib/trpc/routers/nodes/utils/git.ts` — `getCurrentBranch()` returns `HEAD` in this state
- `src/lib/trpc/routers/nodes/procedures/git-status.ts` — status refresh does not check for detached HEAD

## Impact

Medium — affects users who use the terminal alongside Caspian. Operations fail with confusing errors instead of a clear explanation.
