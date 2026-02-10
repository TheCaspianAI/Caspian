# GitHub CLI missing or not authenticated fails silently

## Scenario

User doesn't have the GitHub CLI (`gh`) installed, or hasn't run `gh auth login`.

## Current Behavior

GitHub-related operations return `null` silently. PR status, branch-exists-on-remote checks, and create-from-PR all fail without clear guidance. The `getGitHubUsername` function catches errors silently. Features that depend on `gh` simply don't work, with no indication why.

## What's Missing

- A clear indicator that GitHub integration is unavailable
- Setup instructions when `gh` is not found or not authenticated
- Distinction between "gh not installed" and "gh not authenticated" with appropriate guidance for each

## Key Files

- `src/lib/trpc/routers/nodes/utils/github/github.ts` — GitHub operations that depend on `gh`
- `src/lib/trpc/routers/nodes/utils/git.ts` — `getGitHubUsername()` silently catches errors

## Impact

Medium — GitHub features (PR status, create-from-PR, branch prefix from GitHub username) invisibly don't work. Users may not realize they're missing functionality.
