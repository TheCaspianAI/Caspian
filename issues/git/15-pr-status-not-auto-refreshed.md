# PR status not auto-refreshed

## Scenario

A PR's CI checks finish, a review is submitted, or the PR is closed/merged. The user has the app open.

## Current Behavior

PR data is fetched lazily on hover with a 10-second cache TTL. There is no background polling. The sidebar shows stale PR information (or no information at all) until the user hovers over the node again.

## What's Missing

- Periodic background refresh of PR status for active nodes (even at a low frequency like every 60 seconds)
- Or at minimum, a visible "last updated" timestamp so users know the data may be stale
- Push notifications or polling for status changes on open PRs

## Key Files

- `src/lib/trpc/routers/nodes/utils/github/github.ts` — GitHub status fetching with 10-second cache
- `src/lib/trpc/routers/nodes/procedures/git-status.ts` — `getGitHubStatus` query

## Impact

Medium — users don't get timely feedback about PR state changes. They may miss review requests, CI failures, or merges.
