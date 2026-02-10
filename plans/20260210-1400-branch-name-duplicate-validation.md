# Inline Branch Name Duplicate Validation in NewNodeModal

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

When a user creates a new node in Caspian, they type a "Feature name" which is automatically slugified into a git branch name. If that branch already exists (locally or remotely), the creation will fail deep in the git layer with an unhelpful error. After this change, the user will see an inline message below the branch preview as they type, before they ever press "Create Node". The message will vary based on the state of the conflicting branch:

1. If the branch has an active node open, the "Create Node" button changes to "Go to Node" and clicking it navigates to that node.
2. If the branch has a worktree but no active node (an orphaned worktree), the button changes to "Go to Node" and clicking it reopens the worktree then navigates to it.
3. If the branch exists (local or remote) but has no worktree, the button changes to "Use Existing Branch" and clicking it creates a new node using that existing branch.

The node display name and the branch name are intentionally kept the same — the title the user types IS the branch (after sanitization).


## Assumptions

1. The `branchData` query (`electronTrpc.repositories.getBranches`) already returns all local and remote branches and is already fetched when the "New" tab is active. This data is sufficient for client-side duplicate detection without a new tRPC call.
2. The `getWorktreesByRepository` query returns worktrees with `hasActiveNode` and `node` fields, which is enough to determine which of the three states a conflicting branch is in.
3. The resolved branch prefix (computed client-side in `NewNodeModal` via `resolveBranchPrefix`) matches the prefix that the server would compute. The server-side prefix uses `getBranchPrefix` which reads git config and settings — the client already replicates this via the `resolvedPrefix` memo.
4. Debounce of ~300ms is appropriate for the validation check since it's purely client-side (no network call needed — just filtering in-memory arrays).


## Open Questions

All questions have been resolved — see Decision Log below.


## Progress

- [ ] Milestone 1: Add branch status lookup hook
- [ ] Milestone 2: Integrate inline validation into NewNodeModal
- [ ] Milestone 3: Wire up the three action button states
- [ ] Validation: typecheck, lint, manual testing


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Validation triggers as the user types, debounced at ~300ms.
  Rationale: Purely client-side check against in-memory branch data. Responsive without being noisy.
  Date: 2026-02-10

- Decision: Duplicate check uses the full branch name including prefix (e.g., `john/my-feature`), not just the raw slug.
  Rationale: `john/my-feature` and `my-feature` are different git branches. Only flag a conflict when the exact final branch name matches.
  Date: 2026-02-10

- Decision: Orphaned worktrees (worktree exists, no active node) get the "Go to Node" action which reopens them.
  Rationale: Better UX than just blocking — the worktree is already on disk, so reuse it.
  Date: 2026-02-10

- Decision: Both local and remote branches are checked for duplicates.
  Rationale: Prevents creating a local branch that shadows a remote one, which causes git confusion.
  Date: 2026-02-10

- Decision: When the branch exists but has no worktree, offer "Use Existing Branch" which creates a worktree from it.
  Rationale: More useful than just blocking. The branch exists — let the user work on it.
  Date: 2026-02-10


## Outcomes & Retrospective

(To be filled on completion.)


## Context and Orientation

This change touches the **renderer process** (React UI) and does NOT require new tRPC procedures. All data needed for validation is already fetched by existing queries. Here are the key files and concepts:

### Process Boundaries

Caspian is an Electron app with two processes:
- **Main process** (`src/main/`): Has access to Node.js, the database, git, and the filesystem.
- **Renderer process** (`src/renderer/`): A browser environment running React. Cannot import Node.js modules. Communicates with main via tRPC over IPC.

This plan modifies only renderer code. No new tRPC procedures are needed.

### Key Files

**NewNodeModal** — `src/renderer/components/NewNodeModal/NewNodeModal.tsx`
The modal dialog where users create new nodes. Contains a "Feature name" text input. When the user types, the title is slugified into a branch name via `generateSlugFromTitle()` (which calls `sanitizeSegment()` from `src/shared/utils/branch.ts`). The slugified name is shown in a branch preview line below the input. If the user has a branch prefix configured (e.g., their GitHub username), it's prepended to form the full branch name. The "Create Node" button calls `handleCreateNode()` which invokes the `nodes.create` tRPC mutation.

Key state variables in `NewNodeModal`:
- `title` — raw text the user types
- `branchName` / `branchNameEdited` — for manual branch override in Advanced Options
- `branchSlug` — the sanitized branch name: `sanitizeBranchName(branchName)` if manually edited, else `generateSlugFromTitle(title)` (line 120-122)
- `branchPreview` — the full branch including prefix: if `applyPrefix` and `resolvedPrefix`, then `${resolvedPrefix}/${branchSlug}`, else just `branchSlug` (line 126-127)
- `branchData` — result of `electronTrpc.repositories.getBranches.useQuery()`, contains `{ branches: Array<{ name, lastCommitDate, isLocal, isRemote }>, defaultBranch }` (line 70-76)

**Branch sanitization** — `src/shared/utils/branch.ts`
- `sanitizeSegment(text)`: lowercases, removes special chars, replaces spaces with hyphens, trims to 50 chars.
- `sanitizeBranchName(name)`: splits on `/`, sanitizes each segment, filters empty segments, rejoins.
- `resolveBranchPrefix({ mode, customPrefix, authorPrefix, githubUsername })`: resolves the configured prefix mode to a concrete prefix string.

**Worktree query** — `src/lib/trpc/routers/nodes/procedures/git-status.ts:123-144`
The `getWorktreesByRepository` procedure returns an array of worktree records enriched with:
- `hasActiveNode: boolean` — whether a non-deleted node points to this worktree
- `node: SelectNode | null` — the active node record, or null

This is already used in `ExistingWorktreesList` and is available via `electronTrpc.nodes.getWorktreesByRepository.useQuery()`.

**useOpenWorktree hook** — `src/renderer/react-query/nodes/useOpenWorktree.ts`
Mutation hook that calls `nodes.openWorktree` tRPC procedure to create a new node from an orphaned worktree. On success, it invalidates queries, creates a terminal tab, and navigates to the node.

**useCreateNode hook** — `src/renderer/react-query/nodes/useCreateNode.ts`
Mutation hook that calls `nodes.create` tRPC procedure. On success, navigates to the new node. Accepts `useExistingBranch: true` to create a worktree from an existing branch instead of creating a new branch.

**Node navigation** — `src/renderer/routes/_authenticated/_dashboard/utils/node-navigation.ts`
`navigateToNode(nodeId, navigate)`: sets `localStorage.lastViewedNodeId` and navigates to `/node/$nodeId`.


## Plan of Work

The work has three milestones, each building on the previous.

### Milestone 1: Branch Status Lookup Hook

Create a custom hook that, given the current branch preview string and repository ID, determines the "branch status" — one of four states:

- `available` — branch does not exist, creation can proceed normally
- `has-active-node` — branch exists and has a worktree with an active node
- `has-orphaned-worktree` — branch exists and has a worktree but no active node
- `exists-no-worktree` — branch exists (local or remote) but has no worktree in Caspian

This hook will be a new file at `src/renderer/components/NewNodeModal/hooks/useBranchStatus.ts`. It consumes two existing queries that are already fetched in `NewNodeModal`:

1. `branchData` from `electronTrpc.repositories.getBranches.useQuery()` — provides the full list of branch names (local and remote).
2. A new call to `electronTrpc.nodes.getWorktreesByRepository.useQuery()` — provides worktree-to-node mapping for the selected repository.

The hook signature:

    interface BranchStatus {
      status: "available" | "has-active-node" | "has-orphaned-worktree" | "exists-no-worktree";
      nodeId?: string;       // present when status is "has-active-node"
      worktreeId?: string;   // present when status is "has-orphaned-worktree"
      branchName?: string;   // the matched existing branch name, for "exists-no-worktree"
    }

    function useBranchStatus({
      branchPreview,
      repositoryId,
      branches,
      worktrees,
    }: {
      branchPreview: string;
      repositoryId: string | null;
      branches: Array<{ name: string; isLocal: boolean; isRemote: boolean }> | undefined;
      worktrees: Array<{ branch: string; hasActiveNode: boolean; node: { id: string } | null; id: string }>;
    }): BranchStatus

The logic, step by step:

1. If `branchPreview` is empty or `repositoryId` is null, return `{ status: "available" }`.
2. Debounce the `branchPreview` value by 300ms using a simple `useState` + `useEffect` + `setTimeout` pattern (no external library needed).
3. Check if `branchPreview` matches any entry in the `branches` array (case-insensitive comparison against `branch.name`).
4. If no match, return `{ status: "available" }`.
5. If a match is found, check the `worktrees` array for a worktree whose `branch` field matches (case-insensitive).
6. If a worktree is found with `hasActiveNode: true`, return `{ status: "has-active-node", nodeId: worktree.node.id }`.
7. If a worktree is found with `hasActiveNode: false`, return `{ status: "has-orphaned-worktree", worktreeId: worktree.id }`.
8. If no worktree matches, return `{ status: "exists-no-worktree", branchName: matchedBranch.name }`.

The debounce is implemented inside the hook — only the `branchPreview` input is debounced, the lookup itself is synchronous against in-memory arrays.


### Milestone 2: Integrate Inline Validation into NewNodeModal

Modify `src/renderer/components/NewNodeModal/NewNodeModal.tsx` to:

1. Add the `getWorktreesByRepository` query alongside the existing `getBranches` query. Both are already loaded in `ExistingWorktreesList` for the "Existing" tab, but for the "New" tab we need them in `NewNodeModal` itself.

2. Call `useBranchStatus()` with the current `branchPreview`, `selectedRepositoryId`, the `branchData.branches` array, and the worktrees data.

3. Below the existing branch preview line (the `<p>` at lines 327-332 that shows the git branch icon and `branchPreview`), add an inline status message. The message varies by status:

   - `available`: Show nothing (no message).
   - `has-active-node`: Show a message like "This branch has an open node" in `text-amber-500` with a subtle background. The text should be concise and informative.
   - `has-orphaned-worktree`: Show "This branch has an existing worktree" in `text-amber-500`.
   - `exists-no-worktree`: Show "This branch already exists" in `text-amber-500`.

   The styling should use the existing patterns in the codebase. Looking at the error pattern at lines 359-361 of `NewNodeModal.tsx`, the inline message should follow a similar structure but use amber/warning colors since this is not an error — it's an informational redirect. Use classes like:

       <p className="text-xs text-amber-500 flex items-center gap-1.5">
         {statusMessage}
       </p>

   This message should appear only when the branch preview is visible (i.e., when `title || branchNameEdited` is truthy — same condition as the branch preview line at line 326).

4. The inline message must only appear after the debounce resolves, not while the user is actively typing. The `useBranchStatus` hook handles this internally.


### Milestone 3: Wire Up the Three Action Button States

Modify the "Create Node" button (currently at lines 469-475 of `NewNodeModal.tsx`) to change its label and behavior based on the branch status:

**State: `available`** — No change. Button reads "Create Node" and calls `handleCreateNode()`.

**State: `has-active-node`** — Button changes to "Go to Node". On click:
1. Call `navigateToNode(branchStatus.nodeId, navigate)` to navigate to the existing node.
2. Close the modal via `handleClose()`.
No tRPC mutation is needed — the node already exists and is active.

This requires importing `useNavigate` from `@tanstack/react-router` and `navigateToNode` from `renderer/routes/_authenticated/_dashboard/utils/node-navigation` into `NewNodeModal.tsx`. The `useNavigate` import already exists implicitly through `useCreateNode`, but `NewNodeModal` does not currently call it directly. Add:

    import { useNavigate } from "@tanstack/react-router";
    import { navigateToNode } from "renderer/routes/_authenticated/_dashboard/utils/node-navigation";

And inside the component:

    const navigate = useNavigate();

**State: `has-orphaned-worktree`** — Button changes to "Go to Node". On click:
1. Call `openWorktree.mutateAsync({ worktreeId: branchStatus.worktreeId })` using the existing `useOpenWorktree` hook.
2. The hook's `onSuccess` handler already navigates to the node and invalidates queries.
3. Close the modal via `handleClose()`.

Import `useOpenWorktree` from `renderer/react-query/nodes` (already exported from the barrel at `renderer/react-query/nodes/index.ts`). Instantiate it in the component:

    const openWorktree = useOpenWorktree();

**State: `exists-no-worktree`** — Button changes to "Use Existing Branch". On click:
1. Call the existing `createNode.mutateAsync()` but with `useExistingBranch: true` and the matched `branchName` from the status. This tells the backend to create a worktree from the existing branch rather than trying to create a new branch.
2. The `handleCreateNode` function needs modification: when `branchStatus.status === "exists-no-worktree"`, pass `useExistingBranch: true` and set `branchName` to `branchStatus.branchName`.

Specifically, modify `handleCreateNode` (currently at lines 201-229):

    const handleCreateNode = async () => {
      if (!selectedRepositoryId) return;

      // When using an existing branch, pass useExistingBranch flag
      if (branchStatus.status === "exists-no-worktree" && branchStatus.branchName) {
        try {
          const result = await createNode.mutateAsync({
            repositoryId: selectedRepositoryId,
            name: title.trim() || branchStatus.branchName,
            branchName: branchStatus.branchName,
            baseBranch: effectiveBaseBranch || undefined,
            useExistingBranch: true,
            setupScript: setupScript.trim() || undefined,
            teardownScript: teardownScript.trim() || undefined,
          });
          handleClose();
          if (result.isInitializing) {
            toast.success("Node created", { description: "Setting up in the background..." });
          } else {
            toast.success("Node created");
          }
          return;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to create node");
          return;
        }
      }

      // Default: create new branch
      const nodeName = title.trim() || undefined;
      try {
        const result = await createNode.mutateAsync({
          repositoryId: selectedRepositoryId,
          name: nodeName,
          branchName: branchSlug || undefined,
          baseBranch: effectiveBaseBranch || undefined,
          applyPrefix,
          setupScript: setupScript.trim() || undefined,
          teardownScript: teardownScript.trim() || undefined,
        });
        handleClose();
        if (result.isInitializing) {
          toast.success("Node created", { description: "Setting up in the background..." });
        } else {
          toast.success("Node created");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create node");
      }
    };

Add a `handleGoToNode` function for the active node case:

    const handleGoToNode = () => {
      if (branchStatus.status === "has-active-node" && branchStatus.nodeId) {
        navigateToNode(branchStatus.nodeId, navigate);
        handleClose();
      }
    };

Add a `handleReopenWorktree` function for the orphaned worktree case:

    const handleReopenWorktree = async () => {
      if (branchStatus.status !== "has-orphaned-worktree" || !branchStatus.worktreeId) return;
      try {
        await openWorktree.mutateAsync({ worktreeId: branchStatus.worktreeId });
        handleClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open node");
      }
    };

The button itself (lines 469-475) becomes conditional:

    {branchStatus.status === "has-active-node" && (
      <Button className="w-full h-8 text-sm" onClick={handleGoToNode}>
        Go to Node
      </Button>
    )}
    {branchStatus.status === "has-orphaned-worktree" && (
      <Button
        className="w-full h-8 text-sm"
        onClick={handleReopenWorktree}
        disabled={openWorktree.isPending}
      >
        Go to Node
      </Button>
    )}
    {branchStatus.status === "exists-no-worktree" && (
      <Button
        className="w-full h-8 text-sm"
        onClick={handleCreateNode}
        disabled={createNode.isPending || isBranchesError}
      >
        Use Existing Branch
      </Button>
    )}
    {branchStatus.status === "available" && (
      <Button
        className="w-full h-8 text-sm"
        onClick={handleCreateNode}
        disabled={createNode.isPending || isBranchesError}
      >
        Create Node
      </Button>
    )}

The `disabled` states should also account for pending mutations from `openWorktree`. Add `openWorktree.isPending` to the disable conditions where relevant.

The Enter key handler (`handleKeyDown` at lines 149-160) should also respect the branch status — pressing Enter should trigger the appropriate action based on the current status, not always `handleCreateNode`.


## Concrete Steps

After implementing all three milestones, run these commands from the project root (`/Volumes/Samsung T7/Caspian`):

    bun run typecheck
    # Expected: No type errors

    bun run lint
    # Expected: No lint errors (or only pre-existing ones unrelated to this change)

    bun test
    # Expected: All tests pass

    bun dev
    # Expected: Electron app launches


## Validation and Acceptance

Launch the app with `bun dev`. Open the "Open Node" modal (the new node creation dialog). Select a repository.

**Test 1: No conflict (happy path)**
Type a feature name that does not match any existing branch. The branch preview shows below the input. No inline message appears. The button reads "Create Node". Clicking it creates the node normally.

**Test 2: Branch has an active node**
Type a feature name whose slugified form matches a branch that has an open node (e.g., if you already have a node on branch `my-feature`, type "My Feature"). After a brief debounce, an inline message appears: "This branch has an open node". The button reads "Go to Node". Clicking it closes the modal and navigates to the existing node.

**Test 3: Branch has an orphaned worktree**
Close a node (but don't delete its worktree). Then open the new node modal and type the same feature name. The inline message says "This branch has an existing worktree". The button reads "Go to Node". Clicking it reopens the worktree, closes the modal, and navigates to the node.

**Test 4: Branch exists but no worktree**
If a branch exists in git but has no Caspian worktree (e.g., a branch created from the command line), type its name. The inline message says "This branch already exists". The button reads "Use Existing Branch". Clicking it creates a worktree from the existing branch and navigates to the new node.

**Test 5: Prefix handling**
If you have a branch prefix configured (e.g., `john`), type a name. The preview should show `john/my-feature`. The duplicate check should compare against `john/my-feature`, not just `my-feature`.

**Test 6: Manual branch override**
Open Advanced Options and manually type a branch name. The validation should still work against the manually typed branch (not the auto-generated slug).

**Test 7: Debounce**
Type quickly. The inline message should not flicker — it should only appear after the user pauses for ~300ms.

**Test 8: Enter key**
When the branch has an active node and you press Enter, it should navigate to the node (not try to create). Similarly for the other states.


## Idempotence and Recovery

All changes are in the renderer process and are purely additive — they add a hook file and modify the existing modal component. The changes can be reverted by deleting the hook file and restoring the original `NewNodeModal.tsx`. No database migrations, no schema changes, no new tRPC procedures.

If the `getWorktreesByRepository` query fails or returns empty, the hook defaults to `{ status: "available" }`, so the modal degrades gracefully to its current behavior.


## Interfaces and Dependencies

**New file:**

    src/renderer/components/NewNodeModal/hooks/useBranchStatus.ts

**Modified files:**

    src/renderer/components/NewNodeModal/NewNodeModal.tsx

**No new dependencies.** All libraries used (React, tRPC hooks, TanStack Router) are already in the project. The debounce is implemented with `useState` + `useEffect` + `setTimeout` — no debounce library needed.

**Existing hooks/utilities consumed:**
- `useOpenWorktree` from `renderer/react-query/nodes`
- `navigateToNode` from `renderer/routes/_authenticated/_dashboard/utils/node-navigation`
- `useNavigate` from `@tanstack/react-router`
- `electronTrpc.nodes.getWorktreesByRepository.useQuery()` from tRPC client


## Artifacts and Notes

The `branchPreview` value computed in `NewNodeModal` at lines 126-127 is:

    const branchPreview =
      branchSlug && applyPrefix && resolvedPrefix ? `${resolvedPrefix}/${branchSlug}` : branchSlug;

This is the exact string the hook should compare against existing branch names. The server-side `create` procedure computes the same value at lines 325-337 of `create.ts`:

    const withPrefix = (name: string): string =>
      branchPrefix ? `${branchPrefix}/${name}` : name;
    // ...
    branch = withPrefix(sanitizeBranchName(input.branchName));

So the client-side `branchPreview` and server-side `branch` should match for the same input, making client-side validation reliable. One caveat: the server also checks for prefix collision and may drop the prefix (lines 319-322). The client-side `resolvedPrefix` does not replicate this check. However, prefix collision is an edge case (the prefix itself matching an existing branch name), and in that scenario the worst case is the client shows "available" but the server creates with a slightly different branch name — which is acceptable because there's still no conflict.
