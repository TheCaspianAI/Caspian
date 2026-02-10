# Remote branch force-push not detected

## Scenario

Someone force-pushes to a branch that a local node tracks. Local history and remote history have diverged.

## Current Behavior

Force-push detection exists only in one narrow path: `createWorktreeFromPr` in `git.ts:1503-1520`, which checks `merge-base --is-ancestor`. For all other operations (sync, pull, push), there is no divergence check. `git pull --rebase` fails with a confusing error about diverged branches.

## What's Missing

- Before pull/sync, check if local and remote have diverged (their merge base is not the remote tip)
- Surface divergence to the user with options: reset to remote, force-push local, or manual resolution
- General monitoring for force-pushed branches beyond the PR creation path

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — sync, push, pull procedures
- `src/lib/trpc/routers/nodes/utils/git.ts:1503-1520` — existing divergence check (only in PR path)

## Impact

High — pull/sync fail with cryptic errors. Users have no way to understand or resolve the divergence from within the app.
