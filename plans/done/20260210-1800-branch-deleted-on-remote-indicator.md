# Detect and surface remote branch deletion

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

When a collaborator (or the user from another machine) deletes a branch on the remote, Caspian currently gives no indication. The node sits in the sidebar looking normal. The user only discovers the branch is gone when they try to sync or push, and the error message is a generic git failure ("no such ref was fetched" or "couldn't find remote ref"). This is confusing because the user has no context for why the operation failed.

After this change, Caspian will proactively detect that the remote branch is gone and show two things: an amber warning icon next to the node name in the sidebar, and a warning banner at the top of the Changes panel saying "Branch deleted on remote" with two action buttons. "Push to Restore" re-pushes the local branch to recreate it on the remote. "Delete Node" opens the existing delete dialog to clean up the node and its worktree. The user sees the problem immediately and can act on it without encountering a cryptic git error.

This feature specifically covers branches deleted without a merged PR. When a PR is merged and the branch is auto-deleted, the existing "PR was merged" banner (implemented in the prior plan) handles that case. The two banners are mutually exclusive: merged PR takes priority, then branch-deleted, then neither.


## Assumptions

1. The `gh` CLI is installed and authenticated. If it is not, the `getGitHubStatus` tRPC query returns `null`, and no indicators appear. This is existing behavior and acceptable — the `branchExistsOnRemote` check uses `git ls-remote` which requires network access but not `gh` authentication, however the whole `fetchGitHubPRStatus` function returns `null` on any failure (see `src/lib/trpc/routers/nodes/utils/github/github.ts` line 62-65).

2. The existing 10-second polling interval for GitHub status in `ChangesView.tsx` (line 66) is sufficient for detection. We do not need additional polling.

3. The existing `branchExistsOnRemote` field in `GitHubStatus` (defined in `src/lib/local-db/schema/zod.ts` line 44) accurately reflects the current state of the remote. It uses `git ls-remote --exit-code --heads origin <branchName>` which queries the remote server directly (see `src/lib/trpc/routers/nodes/utils/git.ts` lines 934-998).

4. The existing `push` mutation with `setUpstream: true` (in `src/lib/trpc/routers/changes/git-operations.ts` lines 57-59) will recreate the branch on the remote. This is standard git behavior: `git push --set-upstream origin <branch>` creates the remote branch if it does not exist.

5. The existing `DeleteNodeDialog` component handles all cleanup (terminals, worktree removal, database records). We reuse it.


## Open Questions

None. All design decisions were made during planning (see Decision Log).


## Progress

- [x] (2026-02-10) Codebase discovery and architecture analysis
- [x] (2026-02-10) Design decisions made with user
- [x] (2026-02-10) Plan drafted and approved
- [x] (2026-02-10) Milestone 1: Added "branch deleted" warning banner to ChangesView
- [x] (2026-02-10) Milestone 2: Added warning icon to sidebar NodeRow
- [x] (2026-02-10) Milestone 3: Validation passed — typecheck clean, lint clean, 447 tests all green


## Surprises & Discoveries

- Observation: The `branchExistsOnRemote` boolean was already being computed and returned to the renderer via `GitHubStatus` but was never displayed anywhere in the UI. The entire detection infrastructure existed — only the display layer was missing.
  Evidence: `usePRStatus` hook at `src/renderer/screens/main/hooks/usePRStatus/usePRStatus.ts` line 42 already returns `branchExistsOnRemote`.


## Decision Log

- Decision: Show a warning banner in the Changes panel with "Push to Restore" and "Delete Node" actions.
  Rationale: Matches the visual pattern established by the "PR was merged" banner (see `ChangesView.tsx` lines 331-354). The banner provides context and actionable paths. "Push to Restore" is the most common desired action (the user still wants the branch), while "Delete Node" is cleanup for intentional deletions.
  Date/Author: 2026-02-10, user decision

- Decision: Show a small amber warning icon in the sidebar next to the node name.
  Rationale: Provides at-a-glance status without switching to the node. Mirrors the purple merge icon pattern for merged PRs (see `NodeRow.tsx` line 113). Amber/orange color signals a warning that needs attention without being as severe as red (destructive).
  Date/Author: 2026-02-10, user decision

- Decision: The "branch deleted" banner is mutually exclusive with the "PR merged" banner. If the PR is merged, show the merged banner instead. If the branch is deleted without a merged PR, show the deleted banner.
  Rationale: When a PR is merged with auto-delete enabled, the branch deletion is expected and the merged banner already provides the right context and actions. Showing both banners would be confusing. The merged state is a superset of branch deletion in this context.
  Date/Author: 2026-02-10, plan author

- Decision: Only show the "branch deleted" indicator when `githubStatus` data is available (not null/undefined). Do not show it when GitHub status has not been fetched yet.
  Rationale: The `usePRStatus` hook defaults `branchExistsOnRemote` to `false` when `githubStatus` is null (line 42 of `usePRStatus.ts`). This would cause a false "branch deleted" warning before the first fetch completes or when the `gh` CLI is not installed. By gating on `githubStatus !== null`, we avoid false positives.
  Date/Author: 2026-02-10, plan author

- Decision: Add the push mutation directly to `ChangesView.tsx` rather than creating a shared hook or callback.
  Rationale: The existing `CommitInput` component already has its own push mutation for the commit-and-push flow. Adding a separate mutation in `ChangesView` for the banner's "Push to Restore" button follows the same pattern of each component owning its mutations. This keeps components self-contained per AGENTS.md design principles.
  Date/Author: 2026-02-10, plan author


## Outcomes & Retrospective

The implementation shipped exactly as planned with zero deviations. The two-file, renderer-only change reuses existing components (`LuCloudOff`, `DeleteNodeDialog`, `Button`) and existing data flows (`getGitHubStatus` polling, `changes.push` mutation). No new tRPC procedures, no schema changes, no new dependencies. The key insight was that `branchExistsOnRemote` was already being computed but never surfaced in the UI — making this purely a display-layer addition. Total code added: approximately 50 lines of JSX across 2 files.


## Context and Orientation

Caspian is an Electron desktop app with two processes. The "main process" (in `src/main/`) runs Node.js and handles git operations, database access, and the `gh` CLI. The "renderer process" (in `src/renderer/`) runs React in a browser-like environment and cannot use Node.js modules. All communication between the two goes through tRPC, a typed remote procedure call layer, defined in `src/lib/trpc/routers/`.

A "node" is an active workspace in the Caspian UI. Each node is backed by either a "worktree" (an isolated git checkout in its own directory) or a "branch" (operating on the main repo directory). Nodes appear in a sidebar list. When a user clicks a node, they see its changes, terminal sessions, and file editors in the main content area.

GitHub status (PR info, branch existence on remote) is fetched by calling the `gh` CLI and `git ls-remote` from the main process. The fetching code lives in `src/lib/trpc/routers/nodes/utils/github/github.ts`. It returns a `GitHubStatus` object containing `pr` (with `state: "open" | "draft" | "merged" | "closed"`) and `branchExistsOnRemote: boolean`. The result is cached for 10 seconds in-process and stored in the `worktrees.githubStatus` database column.

The renderer consumes this data through the `getGitHubStatus` tRPC query. Two components fetch it:

1. `ChangesView.tsx` at `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx` — polls every 10 seconds for the active node (line 66).
2. `NodeRow.tsx` at `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx` — lazy-loads on hover for each sidebar row (lines 34-41), with a 5-minute stale time.

A shared hook `usePRStatus` wraps the query and extracts `pr`, `repoUrl`, and `branchExistsOnRemote` at `src/renderer/screens/main/hooks/usePRStatus/usePRStatus.ts`.

The `PRIcon` component at `src/renderer/screens/main/components/PRIcon/PRIcon.tsx` renders colored icons for each PR state: green for open, purple for merged, red for closed, gray for draft. It uses Lucide icons from `react-icons/lu`.

The existing push operation at `src/lib/trpc/routers/changes/git-operations.ts` lines 44-65 accepts a `setUpstream` boolean. When true, it runs `git push --set-upstream origin <branch>` which creates the remote branch if it does not exist. This is exactly what "Push to Restore" needs.

The existing merged PR banner in `ChangesView.tsx` lines 331-354 shows a violet-tinted row with a merge icon, text, and action buttons. We will follow this exact visual pattern but with amber/orange tinting for the "branch deleted" warning.


## Plan of Work

This plan has two implementation milestones plus a validation step. Both milestones are renderer-only changes to existing files. No new tRPC procedures, no schema changes, no new dependencies.


### Milestone 1: Add "branch deleted" warning banner to ChangesView

This is the primary user-facing change. When the active node's remote branch is deleted and the PR is NOT merged, a warning banner appears at the top of the Changes panel (between the header and the commit input) showing "Branch deleted on remote" with "Push to Restore" and "Delete Node" buttons.

The file to edit is `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx`.

First, add a new icon import. We need `LuCloudOff` from `react-icons/lu` to represent a "disconnected from remote" state. Add it to the existing imports from `react-icons/lu` at the top of the file (near line 4 where `LuUndo2` is imported):

    import { LuCloudOff, LuUndo2 } from "react-icons/lu";
    // (replace the existing single LuUndo2 import with this combined import)

No other new imports are needed. `Button`, `DeleteNodeDialog`, `toast`, and the mutation patterns are already imported and used.

Add a push mutation for the "Push to Restore" button. Place it near the other mutations (around line 177, after the `stashPopMutation`):

    const restoreBranchMutation = electronTrpc.changes.push.useMutation({
        onSuccess: () => {
            toast.success("Branch restored on remote");
            handleRefresh();
        },
        onError: (error) => toast.error(`Failed to restore branch: ${error.message}`),
    });

Add a `useState` for the delete dialog. Place it on the line after the existing `showMergedDeleteDialog` state (line 180):

    const [showDeletedBranchDeleteDialog, setShowDeletedBranchDeleteDialog] = useState(false);

Add computed values for the "branch deleted" state. Place these right after the existing merged-PR computed values (after line 311):

    const isBranchDeletedOnRemote =
        githubStatus != null && !githubStatus.branchExistsOnRemote && !isMerged;

This condition is true only when: (a) GitHub status has been fetched successfully (not null), (b) the remote branch does not exist, and (c) the PR is not in "merged" state. The `!isMerged` check ensures the "PR was merged" banner takes priority over the "branch deleted" banner — if a PR was merged and the branch was auto-deleted, the merged banner is the correct one to show.

Insert the "branch deleted" banner JSX immediately after the existing merged-PR banner (after line 354, before the `<CommitInput>` on line 356). The banner follows the same structural pattern as the merged banner but with amber/orange styling:

    {isBranchDeletedOnRemote && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-border">
            <LuCloudOff className="size-4 shrink-0 text-amber-500" />
            <span className="text-xs text-foreground/80 flex-1">
                Branch deleted on remote
            </span>
            <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() =>
                    restoreBranchMutation.mutate({
                        worktreePath: worktreePath || "",
                        setUpstream: true,
                    })
                }
                disabled={restoreBranchMutation.isPending}
            >
                Push to Restore
            </Button>
            <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowDeletedBranchDeleteDialog(true)}
            >
                Delete Node
            </Button>
        </div>
    )}

At the bottom of the component, after the existing `DeleteNodeDialog` for the merged case (after line 622, before the closing `</div>`), add a second `DeleteNodeDialog` for the branch-deleted case:

    {workspaceId && (
        <DeleteNodeDialog
            nodeId={workspaceId}
            nodeName={workspace?.name ?? ""}
            nodeType="worktree"
            open={showDeletedBranchDeleteDialog}
            onOpenChange={setShowDeletedBranchDeleteDialog}
        />
    )}

Verify by running:

    bun run typecheck
    # Expected: No type errors


### Milestone 2: Add warning icon to sidebar NodeRow

This milestone adds a small amber warning icon next to the node name in the sidebar when the node's remote branch has been deleted (and PR is not merged).

The file to edit is `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx`.

Add the `LuCloudOff` import. Modify the existing import from `react-icons/lu` (line 2) to include it:

    import { LuArrowRight, LuCloudOff, LuFolder, LuFolderGit2, LuRotateCw } from "react-icons/lu";

Compute the "branch deleted" state. Add this line after line 44 (where `showDiffStats` is computed):

    const isBranchDeletedOnRemote =
        githubStatus != null && !githubStatus.branchExistsOnRemote && !pr?.state?.includes("merged");

Insert the warning icon in the JSX. Add it immediately after the merged PR indicator (after line 113), before the unread indicator:

    {isBranchDeletedOnRemote && (
        <LuCloudOff className="size-3.5 shrink-0 text-amber-500" />
    )}

The icon appears inline with the node name. It is the same size as the existing merged PR icon (`size-3.5`) and uses amber coloring to signal a warning. Since this relies on hover-triggered data (line 63, `onMouseEnter`), the icon only appears after the user has hovered at least once. This is acceptable — the Changes panel banner (Milestone 1) is the primary indicator for the active node.

Verify by running:

    bun run typecheck
    # Expected: No type errors


### Milestone 3: Validation and acceptance

Run the validation commands:

    bun run typecheck
    # Expected: No type errors

    bun run lint
    # Expected: No lint errors

    bun test
    # Expected: All existing tests pass

Launch the app:

    bun dev

To test the feature manually:

1. Open a repository that has a branch pushed to the remote. Create a node for that branch in Caspian.

2. Delete the remote branch externally. You can do this from the GitHub web UI (Settings > Branches, or via the branch listing page) or from another terminal with `git push origin --delete <branch-name>`.

3. Switch to that node in Caspian. After up to 10 seconds (the polling interval), the Changes panel should show an amber "Branch deleted on remote" banner with "Push to Restore" and "Delete Node" buttons.

4. Hover over the node in the sidebar. A small amber cloud-off icon should appear next to the node name.

5. Click "Push to Restore" in the banner. The branch should be re-pushed to the remote. The banner should disappear on the next poll cycle (within 10 seconds) and a "Branch restored on remote" toast should appear.

6. Delete the remote branch again. Wait for the banner to reappear. Click "Delete Node". The existing delete dialog should open with the usual warnings about uncommitted changes and active terminals.

7. Verify that nodes with a merged PR still show the purple "PR was merged" banner, NOT the amber "branch deleted" banner.

8. Verify that nodes whose branches exist on the remote show neither banner.


## Concrete Steps

All commands should be run from the repository root.

    # After all edits:
    bun run typecheck
    # Expected: No errors

    bun run lint
    # Expected: No errors

    bun test
    # Expected: All tests pass

    bun dev
    # Launch the app and verify manually as described in Milestone 3


## Validation and Acceptance

The feature is complete when all of the following are true:

1. Running `bun run typecheck` produces no type errors.
2. Running `bun run lint` produces no lint errors.
3. Running `bun test` produces no test failures.
4. In the running app (`bun dev`), switching to a node whose remote branch has been deleted (without a merged PR) shows an amber "Branch deleted on remote" banner in the Changes panel within 10 seconds.
5. The banner includes a "Push to Restore" button that re-pushes the branch and shows a success toast.
6. The banner includes a "Delete Node" button that opens the standard delete dialog.
7. Hovering over a node with a deleted remote branch in the sidebar shows an amber cloud-off icon next to the node name.
8. Nodes whose PRs are merged show the purple "PR was merged" banner, NOT the amber "branch deleted" banner.
9. Nodes whose branches exist on the remote show no warning banner and no warning icon.


## Idempotence and Recovery

All changes are purely additive: new JSX, new imports, one new mutation, two new state variables, two new computed values. No existing behavior is modified. Running the implementation steps multiple times is safe. If the implementation fails partway through, the app will still function correctly — the worst case is a partial UI that shows the sidebar icon but not the banner, or vice versa.

The "Push to Restore" action is inherently idempotent: pushing an already-existing branch is a no-op (or updates it with local commits). Clicking it multiple times is safe.


## Artifacts and Notes

The existing merged PR banner pattern (to be replicated with different styling):

    // src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx lines 331-354
    {isMerged && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border-b border-border">
            <PRIcon state="merged" className="size-4 shrink-0" />
            <span className="text-xs text-foreground/80 flex-1">PR #{mergedPrNumber} was merged</span>
            ...buttons...
        </div>
    )}

The `GitHubStatus` type that provides `branchExistsOnRemote`:

    // src/lib/local-db/schema/zod.ts lines 28-46
    export const gitHubStatusSchema = z.object({
        pr: z.object({ ... }).nullable(),
        repoUrl: z.string(),
        branchExistsOnRemote: z.boolean(),  // <-- this field drives the feature
        lastRefreshed: z.number(),
    });

The push mutation that "Push to Restore" will use:

    // src/lib/trpc/routers/changes/git-operations.ts lines 44-65
    push: publicProcedure.input(z.object({
        worktreePath: z.string(),
        setUpstream: z.boolean().optional(),
    })).mutation(async ({ input }) => {
        // When setUpstream=true and no upstream exists:
        // runs git push --set-upstream origin <branch>
        // This creates the branch on the remote if it doesn't exist.
    })

The `LuCloudOff` icon from `react-icons/lu` (Lucide icon set) renders a cloud with a diagonal line through it. It semantically represents "disconnected from remote" or "not available on the cloud/server". This matches the meaning of "your branch no longer exists on the remote server."


## Interfaces and Dependencies

No new libraries or dependencies are needed. All components used already exist:

- `LuCloudOff` from `react-icons/lu` (already available, just not imported in these files)
- `Button` from `src/ui/components/ui/button.tsx`
- `DeleteNodeDialog` from `src/renderer/screens/main/components/NodesListView/components/DeleteNodeDialog/DeleteNodeDialog.tsx`
- `electronTrpc.changes.push` tRPC mutation (already defined in `git-operations.ts`)
- `electronTrpc.nodes.getGitHubStatus` tRPC query (already called in `ChangesView.tsx`)
- `toast` from `src/ui/components/ui/sonner.tsx`

No new tRPC procedures are needed. No database schema changes are needed. The `GitHubStatus` type already contains `branchExistsOnRemote: boolean`.

The only new code is renderer-side JSX in two files:

1. `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx` — one icon import, one mutation, one state variable, one computed value, one JSX banner, one dialog instance.
2. `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx` — one icon import, one computed value, one JSX fragment.
