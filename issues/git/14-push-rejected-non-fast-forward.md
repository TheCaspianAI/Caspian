# Push rejected (non-fast-forward) shows generic error

## Scenario

Remote has commits that local doesn't. Push is rejected by the server.

## Current Behavior

The push error is shown as a generic toast notification. There is no distinction between "you need to pull first" and "branches have diverged (force-push happened)."

## What's Missing

- Detect the specific push rejection reason from the git error message (contains "non-fast-forward" or "rejected")
- Suggest the appropriate action: pull first if it's a simple case, or investigate divergence if histories conflict

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — push procedure

## Impact

Medium — users see a generic "push failed" message with no guidance on how to resolve it.
