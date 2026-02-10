# Push without upstream not handled in standalone push

## Scenario

User creates a branch locally and tries to push (not sync) before setting an upstream.

## Current Behavior

The `push` procedure in `git-operations.ts` calls `git.push()` which fails because there's no upstream configured. The `sync` procedure is smarter — it detects the "no tracking information" error from pull and falls back to `push --set-upstream`. But standalone push has no such fallback.

## What's Missing

- The standalone `push` procedure should detect missing upstream and automatically set it (using `push --set-upstream origin <branch>`)
- Or prompt the user with a clear message and action

## Key Files

- `src/lib/trpc/routers/changes/git-operations.ts` — `push` and `sync` procedures

## Impact

Low — the sync procedure handles this correctly, so users who use sync instead of push are unaffected. Only affects users who explicitly push without having synced first.
