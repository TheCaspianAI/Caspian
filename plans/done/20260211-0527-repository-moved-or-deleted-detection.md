# Detect and recover from moved or deleted repository directories

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

When a user moves or deletes a project folder outside of Caspian, every node associated with that repository silently breaks. Git operations fail with cryptic "not a git repository" errors, and the user has no indication of what went wrong or how to fix it.

After this change, Caspian will detect that a repository's directory no longer exists and show a clear "Repository not found" state in the UI. The user will be able to either point Caspian to the new location of the folder (relocate) or remove the repository and all its nodes from Caspian entirely. The detection happens at two points: once when the app starts up, and again whenever the user navigates to a node belonging to that repository.


## Assumptions

- A1: The `mainRepoPath` column in the `repositories` database table is the single source of truth for where a repository lives on disk. All git operations and worktree paths depend on this value being correct. If this path doesn't exist, the entire repository is broken.

- A2: Worktree paths (stored in the `worktrees` table) are derived from the repository. If the main repository path is gone, individual worktree paths are also assumed invalid. We do not need to validate worktree paths separately for this feature; the repository-level check is sufficient.

- A3: The existing `checkNodeUsability` function in `src/lib/trpc/routers/nodes/utils/usability.ts` already checks whether a node's worktree path exists on disk. This plan adds a higher-level check at the repository level, which runs before node-level checks.

- A4: The `close` procedure on the repositories router (`src/lib/trpc/routers/repositories/repositories.ts`, lines 867-928) already handles killing terminal processes, deleting nodes, and hiding the repository. We will reuse this for the "remove" action. For the "relocate" action, we only need to update `mainRepoPath` and re-validate.


## Open Questions

All resolved. See Decision Log.


## Progress

- [x] (2026-02-11 05:30Z) Milestone 1: Repository health check utility (main process) - Created `src/lib/trpc/routers/repositories/utils/health.ts`
- [x] (2026-02-11 05:32Z) Milestone 2: Startup validation and tRPC procedures - Added startup validation, `pathMissing` to queries, `relocate` and `remove` procedures
- [x] (2026-02-11 05:38Z) Milestone 3: UI - Repository missing state and recovery actions - Created `RepositoryMissingView`, sidebar warning indicators, context menu updates
- [x] (2026-02-11 05:42Z) Milestone 4: Validation - typecheck passes (pre-existing errors only in resizable.tsx), lint passes, all 447 tests pass


## Surprises & Discoveries

- Observation: The codebase uses Biome for formatting with strict rules. Procedures with chained method calls (`.input().mutation()`) need to be on a single line at certain indentation levels.
  Evidence: Biome auto-fix reformatted the `relocate` and `remove` procedures.


## Decision Log

- Decision: Offer "Remove" and "Relocate" as recovery options. No "Re-clone" option for now.
  Rationale: Remove and Relocate cover the two most common scenarios (user deleted the folder, or user moved it). Re-clone adds complexity (needs URL, auth, etc.) and can be done manually via the existing clone flow.
  Date/Author: 2026-02-11 / User

- Decision: Validate repository paths at startup and on-access (when navigating to a node/repository).
  Rationale: Startup validation catches stale repos early so the sidebar immediately reflects reality. On-access validation catches repos that disappear while the app is running (e.g., user deletes folder mid-session). Together they provide comprehensive coverage without polling overhead.
  Date/Author: 2026-02-11 / User

- Decision: Add a `pathMissing` boolean field to the `getAllGrouped` return type rather than filtering out missing repositories.
  Rationale: The UI needs to show missing repositories (with an error state and recovery actions), not hide them. Filtering them out would confuse users who expect to see their project in the sidebar.
  Date/Author: 2026-02-11 / Plan author


## Outcomes & Retrospective

(To be filled at completion.)


## Context and Orientation

Caspian is an Electron desktop app. It has two processes that cannot share code freely:

- The **main process** (`src/main/`) runs Node.js and handles all filesystem access, git operations, and database queries. It is the only process that can call `existsSync`, `access`, `simpleGit`, or read/write the SQLite database.

- The **renderer process** (`src/renderer/`) runs in a browser-like environment (Chromium). It renders the React UI. It cannot use Node.js modules. It communicates with the main process through **tRPC over IPC** (inter-process communication). tRPC is a typed RPC framework; procedures are defined in `src/lib/trpc/routers/` and called from the renderer using `electronTrpc.<router>.<procedure>`.

The database uses SQLite (via the `better-sqlite3` library) with Drizzle ORM for type-safe queries. The schema is at `src/lib/local-db/schema/schema.ts`. The relevant tables are:

- `repositories`: Each row is a git repo the user has opened. The `mainRepoPath` column stores the absolute filesystem path. The `tabOrder` column controls visibility: `null` means hidden (closed), a number means visible.
- `nodes`: Each row is an active workspace. A node belongs to a repository via `repositoryId`. Nodes have a `type` of `"worktree"` (isolated directory) or `"branch"` (works in the main repo directory).
- `worktrees`: Each row is a git worktree on disk. Has a `path` column and belongs to a repository via `repositoryId`.

When the user opens Caspian, the main process starts (`src/main/index.ts`), initializes the database, reconciles terminal daemon sessions, and creates the main window. Currently, there is no validation of repository paths at startup.

The sidebar shows repositories and their nodes. The data comes from the `nodes.getAllGrouped` tRPC procedure (`src/lib/trpc/routers/nodes/procedures/query.ts`, line 125), which fetches all repositories with `tabOrder IS NOT NULL` and all their non-deleted nodes.

When a user navigates to a specific node, the route loader calls `nodes.get` (`src/lib/trpc/routers/nodes/procedures/query.ts`, line 39), which fetches the node, its repository, and its worktree from the database.

The existing `checkNodeUsability` function (`src/lib/trpc/routers/nodes/utils/usability.ts`) already checks if a node's worktree path exists on disk, returning `{ usable: false, reason: "path_missing" }` if not. This plan builds a similar pattern at the repository level.

The only place that currently validates a repository path against the filesystem is inside the `cloneRepo` procedure (`src/lib/trpc/routers/repositories/repositories.ts`, lines 644-681). It checks if the clone destination path still exists, and if not, deletes the stale database record. This logic will be extracted and generalized.


## Plan of Work

The work is organized into four milestones. Each milestone produces a testable result.


### Milestone 1: Repository health check utility (main process)

This milestone creates the core function that checks whether a repository's directory still exists on disk. It follows the same pattern as the existing `checkNodeUsability` in `src/lib/trpc/routers/nodes/utils/usability.ts`.

Create a new file at `src/lib/trpc/routers/repositories/utils/health.ts`. This file will contain two functions:

**`checkRepositoryHealth`**: Takes a repository object (specifically its `mainRepoPath` string) and returns a structured result indicating whether the path exists. Use `existsSync` from Node.js `fs` module (this file is only used in the main process, via tRPC procedures). The return type:

    import { existsSync } from "node:fs";

    export interface RepositoryHealthCheck {
        healthy: boolean;
        reason?: "path_missing";
    }

    export function checkRepositoryHealth({
        mainRepoPath,
    }: {
        mainRepoPath: string;
    }): RepositoryHealthCheck {
        if (!existsSync(mainRepoPath)) {
            return { healthy: false, reason: "path_missing" };
        }
        return { healthy: true };
    }

This function deliberately does NOT check whether the path is a valid git repository (e.g., whether `.git` exists). The scenario in the issue is about the entire directory being moved or deleted, not about git corruption. Keeping the check simple avoids false positives.

**`checkAllRepositoriesHealth`**: Takes a list of repository records and returns a `Map<string, RepositoryHealthCheck>` keyed by repository ID. This is used by the startup check to validate all repositories in one pass.

    export function checkAllRepositoriesHealth(
        repos: Array<{ id: string; mainRepoPath: string }>,
    ): Map<string, RepositoryHealthCheck> {
        const results = new Map<string, RepositoryHealthCheck>();
        for (const repo of repos) {
            results.set(repo.id, checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath }));
        }
        return results;
    }


### Milestone 2: Startup validation and tRPC procedures

This milestone wires the health check into the app startup and exposes it to the renderer via tRPC. It also adds the "relocate" and "remove" procedures.

**2a. Startup validation**

In `src/main/index.ts`, after the database is ready and before `makeAppSetup` creates the window, add a call to validate all active repositories. "Active" means `tabOrder IS NOT NULL` (the same filter used by `getAllGrouped`).

The startup check will log warnings for any missing repositories but will NOT automatically delete them. The user should decide what to do. The check simply ensures the health data is available when the renderer first loads.

Add a new function `validateRepositoryPaths` in a new file `src/main/lib/repository-health.ts`:

    import { isNotNull } from "drizzle-orm";
    import { repositories } from "lib/local-db";
    import { localDb } from "main/lib/local-db";
    import { checkAllRepositoriesHealth } from "lib/trpc/routers/repositories/utils/health";

    export function validateRepositoryPaths(): void {
        const activeRepos = localDb
            .select({ id: repositories.id, mainRepoPath: repositories.mainRepoPath })
            .from(repositories)
            .where(isNotNull(repositories.tabOrder))
            .all();

        const results = checkAllRepositoriesHealth(activeRepos);

        for (const [repoId, check] of results) {
            if (!check.healthy) {
                const repo = activeRepos.find((r) => r.id === repoId);
                console.warn(
                    `[repository-health] Repository path missing: ${repo?.mainRepoPath} (id: ${repoId})`,
                );
            }
        }
    }

Call this from `src/main/index.ts` in the startup sequence, right after `await initAppState()` and before `reconcileDaemonSessions()`. This is synchronous and fast (just `existsSync` calls).

**2b. Expose health in `getAllGrouped`**

Modify the `getAllGrouped` procedure in `src/lib/trpc/routers/nodes/procedures/query.ts` so that each repository group includes a `pathMissing` boolean. Inside the existing loop that builds `groupsMap`, call `checkRepositoryHealth` for each repository and set the flag:

    import { checkRepositoryHealth } from "../../repositories/utils/health";

In the loop at line 165, after setting the repository data in the group, add:

    const health = checkRepositoryHealth({ mainRepoPath: repository.mainRepoPath });

Then include `pathMissing: !health.healthy` in the repository object within the group. The type for the repository in the group will gain this field:

    repository: {
        id: string;
        name: string;
        color: string;
        tabOrder: number;
        githubOwner: string | null;
        mainRepoPath: string;
        defaultBranch: string;
        pathMissing: boolean;   // <-- new field
    };

**2c. Expose health in `nodes.get`**

Modify the `get` procedure in `src/lib/trpc/routers/nodes/procedures/query.ts` so that the returned `repository` object includes `pathMissing`. After fetching the repository from the database (line 48-52), check its health:

    const repoHealth = repository
        ? checkRepositoryHealth({ mainRepoPath: repository.mainRepoPath })
        : null;

Then in the return value, add `pathMissing` to the repository object:

    repository: repository
        ? {
            id: repository.id,
            name: repository.name,
            mainRepoPath: repository.mainRepoPath,
            pathMissing: repoHealth ? !repoHealth.healthy : false,
          }
        : null,

**2d. "Relocate" procedure**

Add a new procedure `relocate` to the repositories router in `src/lib/trpc/routers/repositories/repositories.ts`. This procedure opens a native file dialog (like `openNew` does), validates the selected path is a valid git repository, and updates the `mainRepoPath` in the database.

    relocate: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const repository = localDb
                .select()
                .from(repositories)
                .where(eq(repositories.id, input.id))
                .get();

            if (!repository) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
            }

            const window = getWindow();
            if (!window) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No window available" });
            }

            const result = await dialog.showOpenDialog(window, {
                title: `Locate "${repository.name}"`,
                properties: ["openDirectory"],
                message: `Select the new location of "${repository.name}"`,
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false as const, canceled: true as const };
            }

            const selectedPath = result.filePaths[0];

            // Validate it's a git repository
            let gitRoot: string;
            try {
                gitRoot = await getGitRoot(selectedPath);
            } catch {
                return {
                    success: false as const,
                    canceled: false as const,
                    error: "The selected folder is not a git repository.",
                };
            }

            // Update the repository path
            localDb
                .update(repositories)
                .set({ mainRepoPath: gitRoot, lastOpenedAt: Date.now() })
                .where(eq(repositories.id, input.id))
                .run();

            // Also update any worktree records that used paths under the old mainRepoPath.
            // Branch-type nodes use mainRepoPath directly, so they'll pick up the change automatically.
            // Worktree-type nodes have their own paths which may or may not be under the old repo path.
            // We do NOT move worktrees - those are separate git checkouts that may also be moved/missing.
            // The user will need to recreate worktree nodes if their worktree directories also moved.

            return { success: true as const, canceled: false as const, newPath: gitRoot };
        }),

The "remove" action already exists as the `close` procedure on the repositories router (line 867). It kills terminals, deletes nodes, and hides the repository by setting `tabOrder` to null. For a truly missing repository, we may also want to delete the worktree records (since the worktrees are gone too), but the existing `close` already deletes nodes which is the most important cleanup. We will reuse `close` as-is.

**2e. "Remove" procedure enhancement**

The existing `close` procedure hides the repository (sets `tabOrder = null`) but does not delete the database record. For a missing repository, the user likely wants a full removal. Add a `remove` procedure that deletes the repository record entirely:

    remove: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const repository = localDb
                .select()
                .from(repositories)
                .where(eq(repositories.id, input.id))
                .get();

            if (!repository) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
            }

            // Kill terminal processes for all nodes in this repository
            const repositoryNodes = localDb
                .select()
                .from(nodes)
                .where(eq(nodes.repositoryId, input.id))
                .all();

            const registry = getNodeRuntimeRegistry();
            for (const node of repositoryNodes) {
                const terminal = registry.getForNodeId(node.id).terminal;
                await terminal.killByWorkspaceId(node.id);
            }

            // Delete all nodes for this repository
            if (repositoryNodes.length > 0) {
                localDb
                    .delete(nodes)
                    .where(inArray(nodes.id, repositoryNodes.map((n) => n.id)))
                    .run();
            }

            // Delete all worktrees for this repository
            localDb.delete(worktrees).where(eq(worktrees.repositoryId, input.id)).run();

            // Delete the repository record itself
            localDb.delete(repositories).where(eq(repositories.id, input.id)).run();

            // Update active node if needed
            const closedNodeIds = repositoryNodes.map((n) => n.id);
            const currentSettings = localDb.select().from(settings).get();
            if (
                currentSettings?.lastActiveNodeId &&
                closedNodeIds.includes(currentSettings.lastActiveNodeId)
            ) {
                const remainingNodes = localDb
                    .select()
                    .from(nodes)
                    .orderBy(desc(nodes.lastOpenedAt))
                    .all();
                localDb
                    .update(settings)
                    .set({ lastActiveNodeId: remainingNodes[0]?.id ?? null })
                    .where(eq(settings.id, 1))
                    .run();
            }

            return { success: true };
        }),

Import `worktrees` from `lib/local-db` at the top of the file if not already imported.


### Milestone 3: UI - Repository missing state and recovery actions

This milestone adds the visual indication in the renderer that a repository's path is missing, and wires up the "Relocate" and "Remove" buttons.

**3a. Sidebar indicator in NodeRow**

In `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx`, when the parent repository has `pathMissing: true`, nodes should appear visually degraded. The `NodeRow` component receives its data from the grouped query. Check whether the `NodeRow` or its parent component passes down the repository's `pathMissing` field.

The `NodesListView` component (`src/renderer/screens/main/components/NodesListView/NodesListView.tsx`) iterates over repository groups from `getAllGrouped`. Each group has a `repository` object that will now include `pathMissing`. Pass this flag down to each `NodeRow` within that group.

When `pathMissing` is true on a node's repository:
- Apply 50% opacity to the entire row (similar to closed nodes)
- Add a small warning icon (`HiExclamationTriangle` from `react-icons/hi2`, already used in `NodeInitializingView`) in amber color next to the repository group header
- Disable the "Switch to" hover action

**3b. Repository group header warning**

In the `NodesListView`, the repository group header (the section that shows the repository name and node count) should show a warning indicator when `pathMissing` is true. Add an amber `HiExclamationTriangle` icon and change the header text color to `text-amber-500` to signal something is wrong.

**3c. Node view - "Repository not found" state**

When a user navigates to a node whose repository has `pathMissing: true`, show a full-screen error view similar to the `NodeInitializingView` failed state. This view lives in the `NodeView` component hierarchy.

Create a new component `RepositoryMissingView` at `src/renderer/screens/main/components/NodeView/RepositoryMissingView/RepositoryMissingView.tsx`:

    interface RepositoryMissingViewProps {
        repositoryId: string;
        repositoryName: string;
    }

The component renders:
- A centered layout (same structure as `NodeInitializingView`)
- An amber warning icon (`HiExclamationTriangle`) in a `bg-amber-500/10` circle
- Title: "Repository not found"
- Subtitle: the repository name
- Description: "The project folder for this repository has been moved or deleted. You can point Caspian to the new location, or remove the repository."
- Two buttons:
  - "Remove Repository" (variant `outline`, calls `electronTrpc.repositories.remove.useMutation()`)
  - "Locate Folder" (primary, calls `electronTrpc.repositories.relocate.useMutation()`)

After a successful relocate, invalidate the `nodes` and `repositories` queries so the UI refreshes. After a successful remove, navigate to the start view or the next available node.

Add an `index.ts` barrel export in the `RepositoryMissingView/` directory.

**3d. Wire into NodeView**

The component that decides what to render for a given node needs to check `pathMissing` on the repository. Find where `NodeInitializingView` is conditionally rendered (this is in the parent `NodeView` or the route page component). Add a check before the init check: if the node's repository has `pathMissing: true`, render `RepositoryMissingView` instead of the normal node content.

The route page for a node is at `src/renderer/routes/_authenticated/_dashboard/node/$nodeId/page.tsx`. The `nodes.get` query now returns `repository.pathMissing`. Check this field in the component and render `RepositoryMissingView` if true.

**3e. Context menu option**

In the `ContextHeader` component (`src/renderer/screens/main/components/ContextRail/ContextHeader.tsx`), the right-click context menu includes "Close Repository". When the repository has `pathMissing: true`, replace "Close Repository" with "Remove Repository" and add a "Locate Folder" option. Use the same mutations as in `RepositoryMissingView`.


### Milestone 4: Validation and integration testing

This milestone ensures the feature works end-to-end and all existing code quality checks pass.

Run the standard validation commands:

    bun run typecheck
    bun run lint
    bun test

If there are type errors from the new `pathMissing` field, update any type definitions or interfaces that the `getAllGrouped` or `nodes.get` return types flow into.

Manual QA: Start the app with `bun dev`, open a repository, then move or delete the repository's folder from Finder/terminal while Caspian is running. Navigate to a node in that repository. The "Repository not found" view should appear with "Locate Folder" and "Remove Repository" buttons. Test both actions:

- "Locate Folder" should open a native file picker. Selecting the moved directory should fix the repository.
- "Remove Repository" should clean up all nodes, worktrees, and the repository record, then navigate away.

Restart the app. The sidebar should show the missing repository with a warning indicator immediately on startup (if "Remove" wasn't used).


## Concrete Steps

All commands should be run from the repository root: `/Users/adarsh/.superset/worktrees/Caspian/issue-6`.

After each milestone, run:

    bun run typecheck
    # Expected: No errors

    bun run lint
    # Expected: No errors (or only pre-existing ones)

After all milestones, run:

    bun test
    # Expected: All tests pass

    bun dev
    # Expected: Electron app opens. Open a repo, delete its folder externally,
    # navigate to a node in that repo. The "Repository not found" view appears.


## Validation and Acceptance

Launch the app:

    bun dev

Scenario 1 - Detect missing repository on navigation:
1. Open a repository in Caspian (any project folder)
2. In a separate terminal, move or rename that folder: `mv ~/projects/my-repo ~/projects/my-repo-moved`
3. In Caspian, click on a node belonging to that repository
4. Observe: The "Repository not found" view appears with an amber warning icon, the repository name, and two buttons: "Remove Repository" and "Locate Folder"

Scenario 2 - Relocate:
1. From the "Repository not found" view, click "Locate Folder"
2. A native file picker opens. Navigate to `~/projects/my-repo-moved` and select it
3. Observe: The view refreshes and the node becomes functional again (terminal, file explorer, git operations all work)

Scenario 3 - Remove:
1. From the "Repository not found" view, click "Remove Repository"
2. Observe: The repository and all its nodes disappear from the sidebar. Caspian navigates to the start view or another available node.

Scenario 4 - Startup detection:
1. While Caspian is closed, move a repository folder
2. Launch Caspian with `bun dev`
3. Observe: The sidebar shows the affected repository with an amber warning icon on its group header. Nodes under it appear dimmed.

Run validation commands:

    bun run typecheck   # No type errors
    bun run lint        # No lint errors
    bun test            # All tests pass


## Idempotence and Recovery

All changes in this plan are additive. The new `checkRepositoryHealth` function is pure and side-effect-free; calling it multiple times is safe. The `validateRepositoryPaths` startup function only logs warnings and does not mutate data.

The `relocate` procedure updates `mainRepoPath` in the database. Running it multiple times with the same path is safe (idempotent update). If the user selects a wrong directory, they can relocate again.

The `remove` procedure deletes data. It is idempotent in the sense that calling it on an already-deleted repository returns a `NOT_FOUND` error (no crash, no silent failure).

If the plan is partially implemented and needs to be retried, each milestone builds on the previous one but does not depend on runtime state. Starting from a clean checkout of the changes so far and continuing from the next milestone is safe.


## Artifacts and Notes

Existing pattern to follow for health checks (from `src/lib/trpc/routers/nodes/utils/usability.ts`):

    export function checkNodeUsability(
        nodeId: string,
        worktreePath: string | null | undefined,
    ): NodeUsabilityCheck {
        // ...checks...
        if (!existsSync(worktreePath)) {
            return { usable: false, reason: "path_missing" };
        }
        return { usable: true };
    }

Existing pattern for stale path cleanup (from `src/lib/trpc/routers/repositories/repositories.ts`, lines 644-681):

    const existingRepository = localDb
        .select()
        .from(repositories)
        .where(eq(repositories.mainRepoPath, clonePath))
        .get();

    if (existingRepository) {
        try {
            await access(clonePath);
            // Path exists - reuse
        } catch {
            // Path missing - delete stale record
            localDb.delete(repositories).where(eq(repositories.id, existingRepository.id)).run();
        }
    }

Existing UI pattern for error states (from `NodeInitializingView`):

    <div className="flex flex-col items-center justify-center h-full w-full px-8">
        <div className="flex flex-col items-center max-w-sm text-center space-y-6">
            <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10">
                <HiExclamationTriangle className="size-8 text-destructive" />
            </div>
            <div className="space-y-2">
                <h2 className="text-lg font-medium text-foreground">Title</h2>
                <p className="text-sm text-muted-foreground">Subtitle</p>
            </div>
            <div className="flex gap-3">
                <!-- action buttons -->
            </div>
        </div>
    </div>


## Interfaces and Dependencies

No new external dependencies. All functionality uses existing libraries already in the project:

- `node:fs` (`existsSync`) - for path validation in main process
- `electron` (`dialog`) - for the relocate file picker
- `drizzle-orm` - for database queries
- `@trpc/server` (`TRPCError`) - for structured errors
- `react-icons/hi2` (`HiExclamationTriangle`) - already used in `NodeInitializingView`

New files to create:
- `src/lib/trpc/routers/repositories/utils/health.ts` - health check functions
- `src/main/lib/repository-health.ts` - startup validation
- `src/renderer/screens/main/components/NodeView/RepositoryMissingView/RepositoryMissingView.tsx` - UI component
- `src/renderer/screens/main/components/NodeView/RepositoryMissingView/index.ts` - barrel export

Files to modify:
- `src/main/index.ts` - add startup validation call
- `src/lib/trpc/routers/nodes/procedures/query.ts` - add `pathMissing` to `getAllGrouped` and `get`
- `src/lib/trpc/routers/repositories/repositories.ts` - add `relocate` and `remove` procedures
- `src/renderer/screens/main/components/NodesListView/NodesListView.tsx` - pass `pathMissing` to node rows
- `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx` - dim nodes with missing repo
- `src/renderer/routes/_authenticated/_dashboard/node/$nodeId/page.tsx` - render `RepositoryMissingView`
- `src/renderer/screens/main/components/ContextRail/ContextHeader.tsx` - context menu updates

tRPC procedure signatures:

    // repositories.relocate
    input: z.object({ id: z.string() })
    output: { success: true; canceled: false; newPath: string }
           | { success: false; canceled: true }
           | { success: false; canceled: false; error: string }

    // repositories.remove
    input: z.object({ id: z.string() })
    output: { success: true }
