# PR merged and branch deleted on GitHub

## Scenario

User creates a node, opens a PR from within Caspian, the PR gets merged on GitHub, and the branch is auto-deleted (a common GitHub setting).

## Current Behavior

Nothing proactive happens. The worktree and node persist in the database with stale references. The `branchExistsOnRemote` flag in `githubStatus` gets set to `false` when fetched, but only on hover, not automatically. The PR object becomes `null` because `gh pr view` finds nothing. The user discovers the situation only when they try to sync/push and get a cryptic "no upstream branch" error.

## What's Missing

- No indicator in the sidebar that the branch was merged/deleted
- No periodic check of PR status
- No prompt to clean up the now-dead worktree
- The `branchExistsOnRemote` data exists in the DB but is not surfaced in the UI

## Key Files

- `src/lib/trpc/routers/nodes/utils/github/github.ts` — fetches GitHub status
- `src/lib/local-db/schema/zod.ts` — defines `GitHubStatus` with `branchExistsOnRemote`

## Impact

High — every user who merges PRs via GitHub will encounter this. Stale nodes accumulate with no cleanup path other than manual deletion.
