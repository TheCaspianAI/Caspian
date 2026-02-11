# Move repository health checks from per-query existsSync to background polling with cache

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

Every time the sidebar renders or a user navigates to a node, Caspian calls `existsSync()` — a synchronous, blocking Node.js filesystem call — for every repository to check whether its folder still exists on disk. With React Query's default `staleTime` of 0, these queries refetch on every window focus and component mount. A user with 20 repositories who alt-tabs back to Caspian triggers 20+ blocking filesystem calls on the main Electron thread before the UI can respond.

After this change, repository health results are cached in an in-memory Map in the main process. A background `setInterval` refreshes the cache every 10 seconds by calling `existsSync` outside the query hot path. tRPC query handlers read from cache instead of the filesystem, making them effectively free. When a user relocates or removes a repository, the cache is explicitly invalidated so the UI reflects the change immediately — no waiting for the next polling cycle.

The user will not see any visible change. The sidebar and recovery view behave identically. The improvement is operational: lower main-thread latency during tRPC query handling, no blocking filesystem calls in the IPC response path, and a foundation that scales to any number of repositories.


## Assumptions

- `existsSync` latency is under 1ms per call on local SSDs. The optimization is about preventing main-thread stalls when many calls accumulate during IPC handling, not about individual call cost.

- React Query `staleTime` is 0 (the default) for both `getAllGrouped` and `nodes.get`. This is confirmed by the absence of `staleTime` configuration on these queries in the renderer. This means every window focus, mount, and navigation triggers a refetch.

- The number of repositories will grow into the tens as Caspian gains users who manage many projects. A user with 20+ repositories is the scaling scenario this plan addresses.


## Open Questions

None. All design decisions are resolved in the Decision Log below.


## Progress

- [x] (2026-02-11) Draft and approve the plan.
- [x] (2026-02-11) Create the health cache module (`health-cache.ts`).
- [x] (2026-02-11) Replace startup validation with cache initialization.
- [x] (2026-02-11) Replace direct `checkRepositoryHealth` calls in query procedures with cache reads.
- [x] (2026-02-11) Add explicit cache invalidation after relocate and remove mutations.
- [x] (2026-02-11) Add integration test for cache invalidation flow.
- [x] (2026-02-11) Validate with typecheck, lint, and tests.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Use a simple in-memory Map with a background `setInterval` refresh, not a filesystem watcher (`fs.watch`).
  Rationale: `fs.watch` monitors specific files or directories for changes, but the question here is "does this path exist at all?" — which is different from watching a file for modifications. Watching a parent directory and filtering events would be more complex than a periodic `existsSync` sweep for no meaningful benefit. A 10-second interval is simple, predictable, and easy to reason about.
  Date/Author: 2026-02-11 / agent

- Decision: Cache TTL of 10 seconds via `setInterval`.
  Rationale: The cache exists to avoid per-query filesystem calls, not to delay detection. Worst-case, a moved folder is detected 10 seconds later by the background sweep. In practice, when a user clicks on a node in a missing repository, the context menu offers "Locate folder" — an explicit action that triggers immediate cache invalidation, not the polling cycle.
  Date/Author: 2026-02-11 / agent

- Decision: Keep `existsSync` (synchronous) inside the background refresh callback rather than switching to async `fs.access`.
  Rationale: The background refresh runs on a `setInterval` timer callback, not inside a tRPC query handler. Blocking the main thread for <1ms during a timer callback (checking ~20 paths) is acceptable. Switching to async `fs.access` would make the refresh function asynchronous, which complicates the cache population without meaningful gain. The win is removing `existsSync` from the synchronous IPC response path, not from all code.
  Date/Author: 2026-02-11 / agent

- Decision: Expose cache invalidation as a direct function call, not an event bus.
  Rationale: Only two call-sites need invalidation: `repositories.relocate` and `repositories.remove`. A direct `invalidateRepositoryHealthCache()` import is simpler than an event emitter. If more invalidation points emerge, refactoring to events is straightforward.
  Date/Author: 2026-02-11 / agent


## Outcomes & Retrospective

(To be filled after implementation.)


## Context and Orientation

Caspian is an Electron desktop app. It has two processes that communicate over IPC using tRPC (a typed remote procedure call library). The **main process** (`src/main/`) runs Node.js and handles database queries, git operations, and filesystem I/O. The **renderer process** (`src/renderer/`) is a browser environment running React. Communication goes through tRPC procedures defined in `src/lib/trpc/routers/`. Files in `src/lib/trpc/routers/` are bundled for the main process only, so they can safely import Node.js modules.

A **repository** is a git project the user has opened in Caspian. Its database record lives in the `projects` table (TypeScript name: `repositories`, defined in `src/lib/local-db/schema/schema.ts`). Each repository has a `mainRepoPath` field — the absolute filesystem path to the repository root. A **node** is an active workspace within a repository. Nodes are displayed in the sidebar, grouped by repository.

The health check system determines whether a repository's folder still exists on disk. If it does not, the sidebar shows an amber warning icon and the node view shows a recovery screen. The health check is currently implemented as a direct `existsSync` call inside tRPC query handlers.

Here are the key files and what they do:

`src/lib/trpc/routers/repositories/utils/health.ts` — Defines `checkRepositoryHealth({ mainRepoPath })`, which calls `existsSync(mainRepoPath)` and returns `{ healthy: true }` or `{ healthy: false, reason: "path_missing" }`. Also defines `checkAllRepositoriesHealth(repos)` which batch-checks an array of repositories. These are the core functions that call `existsSync`.

`src/lib/trpc/routers/nodes/procedures/query.ts` — Contains the `nodes.get` and `nodes.getAllGrouped` tRPC procedures. `nodes.get` (line 40) fetches a single node and its repository, calling `checkRepositoryHealth` at line 95. `nodes.getAllGrouped` (line 131) fetches all repositories and their nodes for the sidebar, calling `checkRepositoryHealth` at line 173 inside a loop over all active repositories. These are the hot-path call-sites where `existsSync` blocks the IPC response.

`src/lib/trpc/routers/repositories/repositories.ts` — Contains `relocate` (line 931) and `remove` (line 984) mutation procedures. `relocate` updates a repository's `mainRepoPath` after the user selects a new folder. `remove` deletes a repository and all its nodes. Both must invalidate the health cache after their database mutations.

`src/main/lib/repository-health.ts` — Contains `validateRepositoryPaths()`, a startup-only function that calls `checkAllRepositoriesHealth` for all active repositories and logs warnings for missing paths. This file will be deleted; its functionality is subsumed by the cache initialization.

`src/main/index.ts` — The app entry point. Calls `validateRepositoryPaths()` at line 240 during startup. The `app.on("before-quit")` handler is at line 131. This file will be modified to call `initHealthCache()` at startup and `disposeHealthCache()` on quit.


## Plan of Work

### Milestone 1: Add the health cache module and wire it into existing code

This milestone introduces a new file that caches `existsSync` results in memory and refreshes them on a timer. All existing call-sites are updated to read from cache. At completion, the sidebar and node queries no longer call `existsSync` directly.

**Step 1: Create the cache module.**

Create `src/lib/trpc/routers/repositories/utils/health-cache.ts`. This module maintains a `Map<string, RepositoryHealthCheck>` keyed by repository ID, a refresh timer, and four exported functions.

The module imports `localDb` from `main/lib/local-db` and `repositories` from `lib/local-db` — the same import pattern used by 20+ other files in `src/lib/trpc/routers/`. It imports `checkRepositoryHealth` from the adjacent `./health` module.

The four exported functions:

`initHealthCache()` — Queries all active repositories (those with `tabOrder IS NOT NULL`) from the database. Calls `checkRepositoryHealth({ mainRepoPath })` for each and stores results in the Map keyed by repository ID. Logs a summary: `[repository-health] Cache initialized: N repositories (M missing)`. Starts a `setInterval` that re-runs this sweep every 10 seconds. If a timer already exists (for idempotence), clears it before starting a new one.

`getRepositoryHealth({ repositoryId })` — Returns the cached `RepositoryHealthCheck` for the given repository ID. If the ID is not in the cache (which happens when a new repository is added between refresh cycles), falls back to a live check: queries the database for the repository's `mainRepoPath`, calls `checkRepositoryHealth`, stores the result in the cache, and returns it. If the repository is not found in the database either, returns `{ healthy: true }` as a safe default (the repository was likely just deleted and the query is stale).

`invalidateRepositoryHealthCache()` — Immediately re-runs the full sweep (same logic as the init sweep: query all active repos, call `existsSync` for each, update the Map). Does not restart the timer — the existing interval continues on its original schedule. This is called after `relocate` and `remove` mutations to ensure the next query reads fresh data.

`disposeHealthCache()` — Clears the interval timer (if running) and empties the Map. Called on app quit for clean shutdown.

The refresh function (called both by `initHealthCache` and `invalidateRepositoryHealthCache`) logs `[repository-health] Cache refreshed: N repositories (M missing)` on every cycle except the initial one (which logs "initialized" instead).

Here is the full implementation:

    // src/lib/trpc/routers/repositories/utils/health-cache.ts
    import { isNotNull } from "drizzle-orm";
    import { repositories } from "lib/local-db";
    import { localDb } from "main/lib/local-db";
    import { type RepositoryHealthCheck, checkRepositoryHealth } from "./health";

    const REFRESH_INTERVAL_MS = 10_000;

    const cache = new Map<string, RepositoryHealthCheck>();
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    function sweep(): { total: number; missing: number } {
        const activeRepos = localDb
            .select({ id: repositories.id, mainRepoPath: repositories.mainRepoPath })
            .from(repositories)
            .where(isNotNull(repositories.tabOrder))
            .all();

        cache.clear();
        let missing = 0;
        for (const repo of activeRepos) {
            const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
            cache.set(repo.id, result);
            if (!result.healthy) missing++;
        }
        return { total: activeRepos.length, missing };
    }

    export function initHealthCache(): void {
        const { total, missing } = sweep();
        console.log(
            `[repository-health] Cache initialized: ${total} repositories (${missing} missing)`,
        );

        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
        }
        refreshTimer = setInterval(() => {
            sweep();
        }, REFRESH_INTERVAL_MS);
        refreshTimer.unref();
    }

    export function getRepositoryHealth({
        repositoryId,
    }: {
        repositoryId: string;
    }): RepositoryHealthCheck {
        const cached = cache.get(repositoryId);
        if (cached) return cached;

        // Cache miss: new repo added since last sweep
        const repo = localDb
            .select({ mainRepoPath: repositories.mainRepoPath })
            .from(repositories)
            .where(
                (() => {
                    const { eq } = require("drizzle-orm");
                    return eq(repositories.id, repositoryId);
                })(),
            )
            .get();

        if (!repo) return { healthy: true };

        const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
        cache.set(repositoryId, result);
        return result;
    }

    export function invalidateRepositoryHealthCache(): void {
        sweep();
    }

    export function disposeHealthCache(): void {
        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        cache.clear();
    }

Wait — the above has an issue with the `eq` import. Let me fix the implementation. The `eq` function from `drizzle-orm` should be imported at the top of the file, not dynamically required. Here is the corrected version:

    // src/lib/trpc/routers/repositories/utils/health-cache.ts
    import { eq, isNotNull } from "drizzle-orm";
    import { repositories } from "lib/local-db";
    import { localDb } from "main/lib/local-db";
    import { type RepositoryHealthCheck, checkRepositoryHealth } from "./health";

    const REFRESH_INTERVAL_MS = 10_000;

    const cache = new Map<string, RepositoryHealthCheck>();
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    function sweep(): { total: number; missing: number } {
        const activeRepos = localDb
            .select({ id: repositories.id, mainRepoPath: repositories.mainRepoPath })
            .from(repositories)
            .where(isNotNull(repositories.tabOrder))
            .all();

        cache.clear();
        let missing = 0;
        for (const repo of activeRepos) {
            const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
            cache.set(repo.id, result);
            if (!result.healthy) missing++;
        }
        return { total: activeRepos.length, missing };
    }

    export function initHealthCache(): void {
        const { total, missing } = sweep();
        console.log(
            `[repository-health] Cache initialized: ${total} repositories (${missing} missing)`,
        );

        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
        }
        refreshTimer = setInterval(() => {
            sweep();
        }, REFRESH_INTERVAL_MS);
        refreshTimer.unref();
    }

    export function getRepositoryHealth({
        repositoryId,
    }: {
        repositoryId: string;
    }): RepositoryHealthCheck {
        const cached = cache.get(repositoryId);
        if (cached) return cached;

        const repo = localDb
            .select({ mainRepoPath: repositories.mainRepoPath })
            .from(repositories)
            .where(eq(repositories.id, repositoryId))
            .get();

        if (!repo) return { healthy: true };

        const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
        cache.set(repositoryId, result);
        return result;
    }

    export function invalidateRepositoryHealthCache(): void {
        sweep();
    }

    export function disposeHealthCache(): void {
        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        cache.clear();
    }

**Step 2: Replace startup validation with cache init.**

In `src/main/index.ts`:

Replace the import on line 10:

    // Before
    import { validateRepositoryPaths } from "./lib/repository-health";

    // After
    import { disposeHealthCache, initHealthCache } from "lib/trpc/routers/repositories/utils/health-cache";

Replace the call on line 240:

    // Before
    validateRepositoryPaths();

    // After
    initHealthCache();

Add `disposeHealthCache()` to the quit handler. In the `app.on("before-quit")` block (line 131), add it right before `app.exit(0)` on line 162:

    // Before
    isQuitting = true;
    disposeTray();
    app.exit(0);

    // After
    isQuitting = true;
    disposeHealthCache();
    disposeTray();
    app.exit(0);

Delete `src/main/lib/repository-health.ts` entirely. Its only function (`validateRepositoryPaths`) is now replaced by `initHealthCache`, which does the same work (query active repos, check paths, log warnings for missing ones) plus starts the background refresh.

**Step 3: Replace direct health checks in query procedures.**

In `src/lib/trpc/routers/nodes/procedures/query.ts`:

Change the import on line 7:

    // Before
    import { checkRepositoryHealth } from "../../repositories/utils/health";

    // After
    import { getRepositoryHealth } from "../../repositories/utils/health-cache";

In the `nodes.get` procedure, replace lines 95-97:

    // Before
    const repoHealth = repository
        ? checkRepositoryHealth({ mainRepoPath: repository.mainRepoPath })
        : null;

    // After
    const repoHealth = repository
        ? getRepositoryHealth({ repositoryId: repository.id })
        : null;

In the `nodes.getAllGrouped` procedure, replace line 173:

    // Before
    const health = checkRepositoryHealth({ mainRepoPath: repository.mainRepoPath });

    // After
    const health = getRepositoryHealth({ repositoryId: repository.id });

**Step 4: Invalidate cache after relocate and remove.**

In `src/lib/trpc/routers/repositories/repositories.ts`, add the import (alongside the other imports near the top of the file):

    import { invalidateRepositoryHealthCache } from "./utils/health-cache";

In the `relocate` procedure, after the database update (`localDb.update(repositories).set(...)` at line 977), add:

    invalidateRepositoryHealthCache();

In the `remove` procedure, after the database delete (`localDb.delete(repositories).where(...)` at line 1014), add:

    invalidateRepositoryHealthCache();

### Milestone 2: Add integration test for cache invalidation

This milestone adds one focused integration test that exercises the cache invalidation path: seed a repo pointing to a missing path, call `getAllGrouped`, verify `pathMissing: true`, then create the directory, invalidate the cache, call `getAllGrouped` again, and verify `pathMissing: false`.

**Step 1: Add the test.**

The test goes in `tests/integration/repository-health.test.ts`, which already contains tests for `checkRepositoryHealth` and the `getAllGrouped` pathMissing behavior. Add a new `describe` block after the existing tests.

The test follows the established pattern in this file: create an in-memory test database via `createTestDb()`, seed a repository pointing to a nonexistent temp directory, create a test tRPC caller via `createTestCaller(db)`, and invoke procedures.

To test invalidation, the test needs to import `invalidateRepositoryHealthCache` and call it after creating the directory on disk. Since the test caller uses `mock.module("main/lib/local-db")` to redirect `localDb` to the test database, and the cache module also imports `localDb`, the cache will read from the test database — so the test implicitly exercises the real cache.

The test:

1. Seed a repository with `mainRepoPath` pointing to `<tmpdir>/test-cache-invalidation` (a path that does not exist).
2. Seed a node in that repository.
3. Call `caller.nodes.getAllGrouped()` — expect the repository's `pathMissing` to be `true`.
4. Create the directory at `<tmpdir>/test-cache-invalidation`.
5. Import and call `invalidateRepositoryHealthCache()`.
6. Call `caller.nodes.getAllGrouped()` again — expect `pathMissing` to be `false`.
7. Clean up: close the database, remove the temp directory.


## Concrete Steps

Run these commands after implementing all changes:

    bun run typecheck
    # Expected: No new type errors (pre-existing resizable.tsx errors only)

    bun run lint
    # Expected: Checked N files. No fixes applied.

    bun test src/
    # Expected: All unit tests pass

    bun test --cwd tests/integration
    # Expected: All integration tests pass (existing + new cache invalidation test)


## Validation and Acceptance

Launch the app:

    bun dev
    # Electron app opens. Open DevTools (Cmd+Option+I).
    # In main process console, observe:
    #   [repository-health] Cache initialized: N repositories (0 missing)
    # Navigate between nodes — no additional [repository-health] logs per query.
    # Alt-tab away and back — no [repository-health] logs (queries read from cache).
    # Wait 10+ seconds — the background sweep runs silently (no log unless you add one).

Test path detection via background refresh:

    # In Finder, rename or move a repository folder to a different location.
    # Within 10 seconds, sidebar shows amber warning icon + dimmed nodes for that repo.
    # Navigate to a node in that repo — RepositoryMissingView appears.

Test invalidation after relocate:

    # Click "Locate Folder" in the recovery view, select the moved folder.
    # Recovery view disappears immediately (cache invalidated synchronously, no timer wait).

Run validation commands:

    bun run typecheck   # No new type errors
    bun run lint        # No lint errors
    bun test src/       # All unit tests pass
    bun test --cwd tests/integration  # All integration tests pass


## Idempotence and Recovery

`initHealthCache()` can be called multiple times safely — it clears any existing interval before starting a new one and re-runs the sweep. `invalidateRepositoryHealthCache()` is safe to call at any time and any number of times — it re-runs the sweep and updates the Map.

If the cache module fails to initialize (for example, if the database is not ready when `initHealthCache` is called), `getRepositoryHealth` falls back to a live database query and `checkRepositoryHealth` call. This preserves the current behavior with no regression — queries still work, they just hit `existsSync` directly.

The `setInterval` timer is unref'd (via `timer.unref()`) so it does not prevent the Node.js event loop from exiting. On app quit, `disposeHealthCache()` clears the timer and Map explicitly for clean shutdown. If the app crashes, the interval is garbage-collected with the process — there are no external resources to clean up.

Deleting `src/main/lib/repository-health.ts` is safe because no other file imports from it — only `src/main/index.ts` imports `validateRepositoryPaths`, and that import is being replaced.


## Interfaces and Dependencies

No new external dependencies. All code uses existing modules: `drizzle-orm`, `lib/local-db` (schema), `main/lib/local-db` (database instance), and the existing `checkRepositoryHealth` function.

New module signature:

    // src/lib/trpc/routers/repositories/utils/health-cache.ts
    import type { RepositoryHealthCheck } from "./health";

    export function initHealthCache(): void;
    export function getRepositoryHealth({ repositoryId }: { repositoryId: string }): RepositoryHealthCheck;
    export function invalidateRepositoryHealthCache(): void;
    export function disposeHealthCache(): void;

Modified files summary:

| File | Change |
|------|--------|
| `src/lib/trpc/routers/repositories/utils/health-cache.ts` | NEW — cache module with background polling |
| `src/lib/trpc/routers/nodes/procedures/query.ts` | Import from `health-cache` instead of `health`. Change call-sites from `checkRepositoryHealth({ mainRepoPath })` to `getRepositoryHealth({ repositoryId })`. |
| `src/lib/trpc/routers/repositories/repositories.ts` | Import `invalidateRepositoryHealthCache`. Call it after relocate DB update and remove DB delete. |
| `src/main/index.ts` | Import `initHealthCache`/`disposeHealthCache` instead of `validateRepositoryPaths`. Call `initHealthCache()` at startup, `disposeHealthCache()` on quit. |
| `src/main/lib/repository-health.ts` | DELETE — functionality folded into `health-cache.ts`. |
| `tests/integration/repository-health.test.ts` | Add cache invalidation test. |

The existing `health.ts` file (`src/lib/trpc/routers/repositories/utils/health.ts`) is NOT modified or deleted. It remains as the low-level utility that performs the actual `existsSync` check. The cache module wraps it.
