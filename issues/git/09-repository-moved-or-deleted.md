# Repository directory moved or deleted not detected

## Scenario

The main repository path (`repositories.mainRepoPath`) no longer exists because the user moved or deleted the project folder.

## Current Behavior

All git operations fail at runtime with "not a git repository" errors. The only cleanup path is during a `cloneRepo` call, which checks `access(clonePath)` and removes stale records if the path is gone (`repositories.ts:681-684`). General app usage has no such check.

## What's Missing

- Startup or periodic validation of repository paths
- A "repository not found" state in the UI
- Options to relocate (point to new path) or remove the repository and all its nodes

## Key Files

- `src/lib/trpc/routers/repositories/repositories.ts` — repository management, stale path cleanup only during clone
- `src/main/index.ts` — app startup (no repository path validation)

## Impact

High — all nodes for the affected repository become non-functional. The user gets errors on every interaction with no explanation or recovery path.
