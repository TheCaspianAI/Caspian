# Merge/rebase conflicts have no resolution workflow

## Scenario

User clicks "Sync" or "Pull". The `git pull --rebase` hits a conflict. Git leaves the worktree in a "rebase in progress" state.

## Current Behavior

The error from `git pull --rebase` is caught and shown as a toast notification with a generic message. The worktree is now in a conflicted state, but there is no UI indicator, no conflict file list, and no resolution workflow. The user must open a terminal and resolve manually.

## What's Missing

- Detection of in-progress rebase/merge/cherry-pick state (checkable via `.git/rebase-merge`, `.git/rebase-apply`, `.git/MERGE_HEAD` file existence)
- UI indicator that the worktree is in a conflicted state
- List of conflicted files
- Options to abort the rebase/merge or continue after resolution

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — sync and pull procedures
- `src/lib/trpc/routers/changes/status.ts` — git status queries (does not check for conflict state)

## Impact

High — any user who encounters a conflict is left with a broken-looking node and no guidance. Rebase conflicts are common in active multi-branch workflows.
