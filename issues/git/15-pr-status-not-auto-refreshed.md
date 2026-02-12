# PR status not auto-refreshed

## Scenario

A PR's CI checks finish, a review is submitted, or the PR is closed/merged. The user has the app open.

## Current Behavior

The Changes panel now polls GitHub status every 10 seconds for the active node (`refetchInterval: 10000`), so the active node's PR status stays current. However, PR info for other nodes in the NodesListView is still fetched lazily on hover with a 5-minute stale time. Non-active nodes show stale data until hovered.

## What's Missing

- Background refresh of PR status for non-active nodes in the NodesListView (even at a low frequency like every 60 seconds)
- Or a visible "last updated" timestamp so users know the data may be stale
- Push notifications or webhook-based updates for status changes on open PRs

## Key Files

- `src/lib/trpc/routers/nodes/utils/github/github.ts` — GitHub status fetching with 10-second cache
- `src/lib/trpc/routers/nodes/procedures/git-status.ts` — `getGitHubStatus` query

## Impact

Low-Medium — the active node's PR status is now live. The remaining gap is the NodesListView, which still shows stale info until hovered.
