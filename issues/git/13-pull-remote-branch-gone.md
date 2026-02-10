# Pull when remote branch no longer exists shows generic error

## Scenario

User tries to pull on a branch whose remote counterpart was deleted.

## Current Behavior

`git pull --rebase` fails with an error about missing upstream. The error is shown as a generic toast. No guidance about why the pull failed or what to do.

## What's Missing

- Specific error detection for "remote branch deleted" (the error message contains patterns like "no such ref" or "couldn't find remote ref")
- Actionable options: delete local tracking reference, push to recreate the remote branch, or remove the node

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — pull procedure

## Impact

Medium — the generic error gives users no indication that the branch was deleted remotely, which is a common and recoverable situation.
