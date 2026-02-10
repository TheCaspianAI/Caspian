# Detect and warn when creating a node with an existing branch name

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

Today, when a user creates a new node in Caspian and types a branch name that already exists (locally or on the remote), the app silently proceeds to background initialization. The `git worktree add -b {branch}` command fails because git refuses to create a branch that already exists, and the user sees a cryptic "failed" status with no way to recover other than deleting the node and starting over.

After this change, the user will see real-time feedback as they type their branch name. If the resolved branch name (including any author prefix) matches an existing branch, an inline warning appears below the branch preview with context-sensitive messaging:

- **Branch exists but has no active node/worktree**: "Branch 'feature-x' already exists. Use existing branch?" with a button that switches to "use existing branch" mode.
- **Branch exists AND is already open as a node**: "Branch 'feature-x' is already open as 'My Feature Node'." with a button that navigates to that node.

This prevents wasted time, avoids confusing git errors, and guides the user toward the right action.


## Assumptions

1. The `repositories.getBranches` query (already called by the NewNodeModal) returns sufficiently fresh branch data. We do not need to re-fetch on every keystroke.
2. The branch name matching should be case-sensitive, matching git's behavior on case-sensitive filesystems (the majority case for macOS default and Linux).
3. The prefix logic in the renderer (`resolveBranchPrefix` from `shared/utils/branch.ts`) produces the same result as the server-side `getBranchPrefix` from `src/lib/trpc/routers/nodes/utils/git.ts`. This is true because the renderer uses the same settings data to resolve the prefix.


## Open Questions

None remaining. All questions were resolved during planning.


## Progress

- [ ] Milestone 1: Extend `repositories.getBranches` to include node/worktree usage data.
- [ ] Milestone 2: Add collision detection logic and inline warning UI to NewNodeModal.
- [ ] Milestone 3: Add server-side guard in the `create` procedure.
- [ ] Milestone 4: Validation (typecheck, lint, manual test).


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Use `repositories.getBranches` as the data source rather than adding a second query to `nodes.getBranches`.
  Rationale: The modal already fetches `repositories.getBranches`. Adding node/worktree usage info to its response avoids an additional query and keeps the component simpler. The `nodes.getBranches` procedure exists but serves a different UI context (the branch switcher inside a node).
  Date/Author: 2026-02-10 / Plan author.

- Decision: Check collision using the fully-resolved branch name (with prefix applied) against the branch list.
  Rationale: The user sees a preview like `john/feature-x from main`. The collision check must match this exact string, not just the slug. The prefix is computed in the renderer via `resolveBranchPrefix`, and the branch list from `getBranches` contains full branch names. So we compare `resolvedPrefix + "/" + branchSlug` (or just `branchSlug` if no prefix) against `branchData.branches[].name`.
  Date/Author: 2026-02-10 / Plan author.

- Decision: Inline warning with options (not blocking, not a dialog).
  Rationale: User preference. Non-blocking inline warnings respect the user's flow and let them decide without a modal interruption.
  Date/Author: 2026-02-10 / Plan author.

- Decision: Real-time checking against already-fetched data, not on-submit.
  Rationale: User preference. The branch list is already in memory from the `repositories.getBranches` query. Checking as the user types is instant and provides immediate feedback.
  Date/Author: 2026-02-10 / Plan author.

- Decision: Distinguish "branch exists, no worktree" from "branch exists AND has active node".
  Rationale: User preference. These are meaningfully different situations requiring different actions.
  Date/Author: 2026-02-10 / Plan author.


## Outcomes & Retrospective

(To be filled at completion.)


## Context and Orientation

Caspian is an Electron desktop app. It has two processes: a **main process** (Node.js, can use filesystem and git) and a **renderer process** (browser environment, React UI). They communicate via **tRPC over IPC** — the renderer calls procedures defined in the main process, and data flows back as typed responses.

This change touches both processes:

- **Renderer process**: `src/renderer/components/NewNodeModal/NewNodeModal.tsx` — the dialog where users create new nodes. This is where the inline warning will appear.
- **Main process (tRPC procedures)**: `src/lib/trpc/routers/repositories/repositories.ts` — the `getBranches` procedure that returns branch data. We will extend its response to include which branches are in use by existing nodes.
- **Main process (tRPC procedures)**: `src/lib/trpc/routers/nodes/procedures/create.ts` — the `create` procedure. We will add a server-side guard.
- **Shared utilities**: `src/shared/utils/branch.ts` — contains `sanitizeBranchName`, `sanitizeSegment`, and `resolveBranchPrefix`. Already used by the renderer. No changes needed here.

Key data flow for the NewNodeModal today:

1. User opens modal. Zustand store `useNewNodeModalOpen()` controls visibility.
2. User selects a repository. This triggers `repositories.getBranches` query, which returns `{ branches: Array<{ name, lastCommitDate, isLocal, isRemote }>, defaultBranch }`.
3. User types a title. The slug is computed: `sanitizeSegment(title)`. If the user hasn't manually edited the branch name, the preview is `resolvedPrefix/slug` (or just `slug` if no prefix).
4. User clicks "Create Node". The `create` mutation fires with `{ repositoryId, name, branchName, baseBranch, applyPrefix, ... }`.

The branch name the server ultimately creates is computed in the `create` procedure at `src/lib/trpc/routers/nodes/procedures/create.ts:336-337`:

    branch = withPrefix(sanitizeBranchName(input.branchName));

Where `withPrefix` prepends the resolved prefix. This matches the renderer's preview logic.

The node/worktree relationship: each active node in the sidebar has a `branch` field. Nodes of type `"worktree"` have an associated worktree record. When we say "branch is in use by a node," we mean there exists a non-deleted node (`deletingAt IS NULL`) whose `branch` field matches.


## Plan of Work

### Milestone 1: Extend `repositories.getBranches` response

**File**: `src/lib/trpc/routers/repositories/repositories.ts`

The `getBranches` procedure (line 263) currently returns `{ branches, defaultBranch }`. We will add a `branchNodes` field: a record mapping branch names to node info for branches that have active (non-deleted) nodes.

In the procedure body, after the existing branch-gathering logic and before the return statement (around line 430), add a database query:

1. Import `nodes` from `lib/local-db` and `isNull` from `drizzle-orm` (both are already available in the file — check existing imports and add if missing).
2. Query all non-deleted nodes for this repository:

        const activeNodes = localDb
            .select({ id: nodes.id, branch: nodes.branch, name: nodes.name, type: nodes.type })
            .from(nodes)
            .where(and(eq(nodes.repositoryId, input.repositoryId), isNull(nodes.deletingAt)))
            .all();

3. Build a lookup map:

        const branchNodes: Record<string, { nodeId: string; nodeName: string; type: string }> = {};
        for (const node of activeNodes) {
            branchNodes[node.branch] = { nodeId: node.id, nodeName: node.name, type: node.type };
        }

4. Update the return type annotation to include `branchNodes`:

        Promise<{
            branches: Array<{ name: string; lastCommitDate: number; isLocal: boolean; isRemote: boolean }>;
            defaultBranch: string;
            branchNodes: Record<string, { nodeId: string; nodeName: string; type: string }>;
        }>

5. Return it:

        return { branches, defaultBranch, branchNodes };

This is a backward-compatible addition — existing callers that don't use `branchNodes` are unaffected.


### Milestone 2: Add collision detection and inline warning UI to NewNodeModal

**File**: `src/renderer/components/NewNodeModal/NewNodeModal.tsx`

This milestone adds real-time collision detection and an inline warning component.

**Step 2a: Compute the collision state**

Inside the `NewNodeModal` component, after the `branchPreview` computation (around line 127), add a `useMemo` that checks for collisions:

    const branchCollision = useMemo(() => {
        if (!branchData?.branches || !branchPreview) return null;

        const finalBranchName = branchPreview;
        const matchingBranch = branchData.branches.find(
            (b) => b.name === finalBranchName,
        );
        if (!matchingBranch) return null;

        const existingNode = branchData.branchNodes?.[finalBranchName];
        if (existingNode) {
            return {
                type: "has-node" as const,
                branchName: finalBranchName,
                nodeId: existingNode.nodeId,
                nodeName: existingNode.nodeName,
            };
        }

        return {
            type: "branch-exists" as const,
            branchName: finalBranchName,
        };
    }, [branchPreview, branchData]);

This memo returns `null` (no collision), `{ type: "has-node", ... }` (branch is open as a node), or `{ type: "branch-exists", ... }` (branch exists but no node).

**Step 2b: Import the navigation hook**

The "navigate to existing node" action needs `useNavigateToNode` or equivalent. Look for the navigation pattern used elsewhere in the codebase. The `useCreateNode` hook in `src/renderer/react-query/nodes/useCreateNode.ts` navigates via `navigate({ to: "/nodes/$nodeId", params: { nodeId } })` using TanStack Router. We will use the same pattern in the modal. Import `useNavigate` from `@tanstack/react-router` (it is already used elsewhere in the renderer).

**Step 2c: Handle "Use existing branch"**

When the user clicks "Use existing branch," we need to re-invoke the create mutation with `useExistingBranch: true` and the exact branch name. Modify `handleCreateNode`:

Add a parameter to `handleCreateNode` to optionally force existing branch mode:

    const handleCreateNode = async (options?: { useExistingBranch?: boolean }) => {
        if (!selectedRepositoryId) return;

        const nodeName = title.trim() || undefined;
        const useExisting = options?.useExistingBranch ?? false;

        try {
            const result = await createNode.mutateAsync({
                repositoryId: selectedRepositoryId,
                name: nodeName,
                branchName: useExisting ? branchPreview : (branchSlug || undefined),
                baseBranch: effectiveBaseBranch || undefined,
                applyPrefix: useExisting ? false : applyPrefix,
                useExistingBranch: useExisting,
                setupScript: setupScript.trim() || undefined,
                teardownScript: teardownScript.trim() || undefined,
            });
            // ... rest unchanged
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create node");
        }
    };

When `useExistingBranch` is true, we pass the full `branchPreview` (which already includes the prefix) as the `branchName`, and set `applyPrefix: false` to prevent double-prefixing. This matches what the server expects.

Update the existing call sites: the `handleKeyDown` handler and the "Create Node" button's `onClick` both call `handleCreateNode()` with no arguments, which preserves current behavior.

**Step 2d: Render the inline warning**

Below the branch preview line (the `<p>` element showing the branch icon and name, around line 327-332), add the collision warning. It should appear only when there is a collision:

    {branchCollision && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs">
            {branchCollision.type === "has-node" ? (
                <>
                    <span className="text-amber-700 dark:text-amber-300 flex-1">
                        Branch <span className="font-mono font-medium">{branchCollision.branchName}</span> is already open as "{branchCollision.nodeName}"
                    </span>
                    <button
                        type="button"
                        className="shrink-0 text-amber-700 dark:text-amber-300 underline hover:no-underline"
                        onClick={() => {
                            navigate({
                                to: "/nodes/$nodeId",
                                params: { nodeId: branchCollision.nodeId },
                            });
                            handleClose();
                        }}
                    >
                        Go to node
                    </button>
                </>
            ) : (
                <>
                    <span className="text-amber-700 dark:text-amber-300 flex-1">
                        Branch <span className="font-mono font-medium">{branchCollision.branchName}</span> already exists
                    </span>
                    <button
                        type="button"
                        className="shrink-0 text-amber-700 dark:text-amber-300 underline hover:no-underline"
                        onClick={() => handleCreateNode({ useExistingBranch: true })}
                    >
                        Use existing branch
                    </button>
                </>
            )}
        </div>
    )}

This uses the amber warning color pattern consistent with the `DeleteNodeDialog` component elsewhere in the codebase.

**Step 2e: Adjust the Create button behavior**

When a collision of type `"has-node"` is detected (the branch is already open as a node), the "Create Node" button should still work but creates a duplicate node for the same branch — which may not be desired. Two options:

1. Disable the button when `branchCollision?.type === "has-node"` since the user should navigate to the existing node instead.
2. Leave it enabled and let the server handle it.

We choose option 1 for the `has-node` case only. For the `branch-exists` case, the button remains enabled — the user can still create a new branch that shadows the existing one (the server will create a new worktree with `-b`, which will fail and surface as a background error). But the warning gives them the better option.

Update the button's disabled condition:

    <Button
        className="w-full h-8 text-sm"
        onClick={() => handleCreateNode()}
        disabled={
            createNode.isPending ||
            isBranchesError ||
            branchCollision?.type === "has-node"
        }
    >
        Create Node
    </Button>


### Milestone 3: Add server-side guard in the `create` procedure

**File**: `src/lib/trpc/routers/nodes/procedures/create.ts`

Even with client-side detection, we should guard against the case where the branch already exists and `useExistingBranch` is not set. This prevents the confusing background failure.

After the branch name is resolved (around line 343, after `branch` is assigned its final value), and before the worktree/node DB inserts, add:

    if (!input.useExistingBranch) {
        const branchAlreadyExists = existingBranches.some(
            (b) => b.toLowerCase() === branch.toLowerCase(),
        );
        if (branchAlreadyExists) {
            throw new Error(
                `Branch "${branch}" already exists. Use "Use existing branch" to create a worktree from it, or choose a different branch name.`,
            );
        }
    }

Note: `existingBranches` is already computed at line 299 as `[...local, ...remote]`. The check uses case-insensitive comparison here as a safety net (git branch names are case-sensitive on Linux but case-insensitive on macOS default filesystem). This server-side guard catches edge cases where the client-side check might miss a branch (e.g., race condition with another user pushing a branch between fetch and create).

The error message will appear as a toast in the renderer because `handleCreateNode` already catches errors and shows them via `toast.error(...)`.


### Milestone 4: Validation

Run all validation commands and manually test the feature.


## Concrete Steps

After implementing the changes above, run:

    cd /Volumes/Samsung\ T7/Caspian
    bun run typecheck
    # Expected: No type errors

    bun run lint
    # Expected: No lint errors (or only pre-existing ones)

    bun test
    # Expected: All tests pass

For manual testing:

    bun dev
    # Electron app opens

Then:

1. Open the "Open Node" modal (click "+" or use keyboard shortcut).
2. Select a repository that has existing branches.
3. Type a title that produces a branch name matching an existing branch (e.g., if `main` exists, type "main" as the title — the slug will be `main`).
4. Observe: an amber inline warning appears below the branch preview saying the branch already exists, with a "Use existing branch" link.
5. Click "Use existing branch" — the node should be created using the existing branch.
6. Repeat with a branch that already has an open node.
7. Observe: the warning says the branch is already open as a specific node name, with a "Go to node" link. The "Create Node" button should be disabled.
8. Click "Go to node" — the modal closes and navigates to the existing node.


## Validation and Acceptance

Launch the app:

    bun dev
    # Electron app opens

**Test 1 — No collision (happy path):** Type a unique branch name. No warning appears. "Create Node" works as before.

**Test 2 — Branch exists, no node:** Type a name matching an existing branch that has no active node. Amber warning appears: `Branch "X" already exists` with "Use existing branch" link. Clicking the link creates the node using the existing branch. The "Create Node" button remains enabled (but would fail during background init if clicked without using existing branch — now guarded by server-side check that surfaces a toast error).

**Test 3 — Branch exists with active node:** Type a name matching a branch that is already open as a node. Amber warning appears: `Branch "X" is already open as "Y"` with "Go to node" link. "Create Node" button is disabled. Clicking "Go to node" closes modal and navigates.

**Test 4 — Server-side guard:** Temporarily disable the client-side check. Attempt to create a node with an existing branch name. The server rejects with a clear error message shown as a toast.

**Test 5 — Prefix handling:** Enable a branch prefix (e.g., author mode). Type a name. The collision check uses the full prefixed branch name, not just the slug.

Run validation commands:

    bun run typecheck   # No type errors
    bun run lint        # No lint errors
    bun test            # All tests pass


## Idempotence and Recovery

All changes are additive. Running the plan multiple times produces the same result:

- The `branchNodes` field is added to `getBranches` response — if already present, no change.
- The collision detection memo in the renderer is pure computation — no side effects.
- The server-side guard throws an error but does not modify state — safe to retry.

If a step fails partway:

- **Milestone 1 fails**: Revert changes to `repositories.ts`. The modal continues to work without collision detection.
- **Milestone 2 fails**: Revert changes to `NewNodeModal.tsx`. The modal works as before. Milestone 1's extra data is harmless.
- **Milestone 3 fails**: Revert changes to `create.ts`. The client-side detection (Milestone 2) still provides the warning.


## Artifacts and Notes

Existing branch preview in the modal (line 326-332 of NewNodeModal.tsx):

    {(title || branchNameEdited) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <GoGitBranch className="size-3" />
            <span className="font-mono">{branchPreview || "branch-name"}</span>
            <span className="text-muted-foreground/60">from {effectiveBaseBranch}</span>
        </p>
    )}

Warning color pattern from DeleteNodeDialog:

    <div className="text-sm text-amber-700 dark:text-amber-300
                    bg-amber-100 dark:bg-amber-950/50
                    border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">

We use a slightly adjusted version with `/10` and `/30` opacity for a subtler appearance within the compact modal form.


## Interfaces and Dependencies

No new dependencies. All tools used are already in the codebase:

- `drizzle-orm` queries (`select`, `from`, `where`, `eq`, `and`, `isNull`) — used throughout `src/lib/trpc/routers/`
- `useMemo` from React — already imported in NewNodeModal
- `useNavigate` from `@tanstack/react-router` — already used in the renderer
- `toast` from `ui/components/ui/sonner` — already imported in NewNodeModal

The `repositories.getBranches` return type gains one field:

    branchNodes: Record<string, { nodeId: string; nodeName: string; type: string }>

The `handleCreateNode` function gains an optional parameter:

    handleCreateNode(options?: { useExistingBranch?: boolean }): Promise<void>
