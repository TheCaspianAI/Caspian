# Branch deleted on remote without a PR

## Scenario

A collaborator (or the user from another machine) deletes a branch on the remote. The local node still references it.

## Current Behavior

No detection occurs. `git fetch --prune` is never run automatically, so even `origin/<branch>` refs linger locally. Operations fail at the point of push/pull with generic error messages.

## What's Missing

- Background or periodic `fetch --prune` to clean stale remote refs
- UI indicator when a tracked remote branch disappears
- Specific error handling when push/pull fails because the remote branch no longer exists

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — sync, push, pull procedures
- `src/lib/trpc/routers/nodes/utils/github/github.ts` — `branchExistsOnRemote()` check

## Impact

High — users discover branch deletion only through failed sync/push operations with unhelpful error messages.
