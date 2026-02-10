# Show PR merged status and clean up deleted branches

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.


## Purpose / Big Picture

When a user merges a pull request on GitHub and the branch is auto-deleted (a very common GitHub setting), Caspian currently gives no indication that this happened. The node sits in the sidebar looking normal. The user only discovers the branch is gone when they try to sync or push and get a cryptic git error. This is the most common lifecycle endpoint for a feature branch, and Caspian should handle it gracefully.

After this change, a user who merges a PR on GitHub will see two things happen automatically in Caspian: a purple merge icon appears next to the node name in the sidebar, and a banner appears at the top of the Changes panel saying "PR #N was merged" with a "Delete Node" button. Clicking that button deletes the node and removes the worktree from disk, the same action as the existing "Delete node" flow. The user can also dismiss the banner and continue working if they want to keep the node around.


## Assumptions

1. The `gh` CLI is installed and authenticated. If it is not, GitHub status returns `null` and no indicators appear. This is the existing behavior and is acceptable.

2. The existing 10-second polling interval for GitHub status on the active node (in `ChangesView.tsx`) is sufficient for detection. We do not need background polling for all nodes.

3. The `gh pr view` command returns merged PRs correctly — it does not require a branch to exist on the remote to find a PR associated with the current worktree's tracking ref. This assumption needs verification during implementation (see Spike in Milestone 1).

4. The existing `deleteNode` mutation in `src/lib/trpc/routers/nodes/procedures/delete.ts` handles all cleanup (terminals, worktree removal, database records). We reuse it rather than building a separate cleanup flow.


## Open Questions

None remaining. All questions were resolved during planning.


## Progress

- [x] (2026-02-10) Codebase discovery and architecture analysis
- [x] (2026-02-10) Design decisions made with user
- [x] (2026-02-10) Plan drafted
- [x] (2026-02-10) Milestone 1: Verified `gh pr view` returns MERGED state for merged PRs even when remote branch is deleted
- [x] (2026-02-10) Milestone 2: Added merged badge to sidebar NodeRow
- [x] (2026-02-10) Milestone 3: Added merged banner to ChangesView with Delete Node and View actions
- [x] (2026-02-10) Milestone 4: Validation passed — typecheck, lint, 447 tests all green


## Surprises & Discoveries

- Observation: `gh pr view` (without arguments) successfully returns merged PR data even when the remote branch has been deleted. It finds the PR via the local branch's tracking ref, not by checking the remote.
  Evidence: Tested with PR #12 on the `add/claude-commands` branch. `gh pr view --json state` returned `"state": "MERGED"` while `git ls-remote --exit-code --heads origin add/claude-commands` returned exit code 2 (not found).

- Observation: The `bun run lint` command runs `biome check .` which, when triggered by a hook, can auto-fix files and strip imports it considers unused. This caused changes to be lost during the first implementation attempt.
  Evidence: After applying imports and JSX in separate edits, the hook between edits removed the "unused" imports before the JSX that referenced them was added.


## Decision Log

- Decision: Primary action on merged PR is "Delete node + worktree" (a single button).
  Rationale: When a PR is merged, the feature branch's job is done. The most common next step is cleanup. Offering a single "Delete Node" action matches the existing delete flow and keeps things simple. Users who want to keep the node can dismiss the banner.
  Date/Author: 2026-02-10, user decision

- Decision: Show indicators in both the sidebar (small merge icon) and the Changes panel (banner with action).
  Rationale: The sidebar badge provides at-a-glance status without needing to switch to the node. The banner provides context and an actionable cleanup path when the user views the node.
  Date/Author: 2026-02-10, user decision

- Decision: Poll only the active node at the existing 10-second interval. Other nodes detect on hover.
  Rationale: Background polling all nodes would consume more `gh` CLI calls and battery. The current lazy-loading pattern on hover is already established. For the active node, the 10-second interval is already in place in `ChangesView.tsx` line 64.
  Date/Author: 2026-02-10, user decision

- Decision: Reuse the existing `usePRStatus` hook for sidebar badge data instead of adding PR state to the `NodeItem` type.
  Rationale: The `NodeItem` type is populated by the `getAllGrouped` tRPC query which fetches all nodes at once. Adding PR status there would require N GitHub API calls on every render. The current lazy-on-hover pattern avoids this cost. We simply extend what `NodeRow` already renders based on the lazy-loaded data.
  Date/Author: 2026-02-10, plan author


## Outcomes & Retrospective

The implementation shipped exactly as planned with zero deviations. The two-file, renderer-only change reuses existing components (`PRIcon`, `DeleteNodeDialog`) and existing data flows (`getGitHubStatus` polling). No new tRPC procedures, no schema changes, no new dependencies. The Milestone 1 spike confirmed the key assumption that `gh pr view` works for merged PRs with deleted remote branches, which de-risked the entire approach. Total code added: 45 lines of JSX across 2 files.


## Context and Orientation

Caspian is an Electron desktop app. It has two processes that communicate via tRPC (a typed remote procedure call layer). The "main process" runs Node.js and handles git operations, database access, and the GitHub CLI. The "renderer process" runs React in a browser-like environment and cannot use Node.js modules. All data flows from main to renderer through tRPC queries and mutations defined in `src/lib/trpc/routers/`.

A "node" is an active workspace in the Caspian UI. Each node is backed by either a "worktree" (an isolated git checkout in its own directory) or a "branch" (operating on the main repo directly). Nodes appear in a sidebar list. When a user clicks a node, they see its changes, terminal sessions, and file editors.

GitHub status (PR info, branch existence) is fetched by calling the `gh` CLI from the main process. The fetching code lives in `src/lib/trpc/routers/nodes/utils/github/github.ts`. It returns a `GitHubStatus` object that includes `pr` (with `state: "open" | "draft" | "merged" | "closed"`) and `branchExistsOnRemote: boolean`. This data is cached for 10 seconds in-process and stored in the `worktrees.githubStatus` database column.

The renderer consumes this data through the `getGitHubStatus` tRPC query. Two components fetch it:

1. `ChangesView.tsx` — polls every 10 seconds for the active node (`src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx`, line 59-66).

2. `NodeRow.tsx` — lazy-loads on hover for each sidebar row (`src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx`, line 34-40).

A shared hook `usePRStatus` wraps the query and extracts `pr`, `repoUrl`, and `branchExistsOnRemote` (`src/renderer/screens/main/hooks/usePRStatus/usePRStatus.ts`).

The existing `PRIcon` component renders colored icons for each PR state: green for open, purple for merged, red for closed, gray for draft (`src/renderer/screens/main/components/PRIcon/PRIcon.tsx`).

Node deletion is handled by the `delete` mutation in `src/lib/trpc/routers/nodes/procedures/delete.ts`. It marks the node as deleting (soft-delete via `deletingAt` timestamp), kills terminal sessions, removes the git worktree, and hard-deletes the database records. The renderer uses `useDeleteNode` hook (`src/renderer/react-query/nodes/useDeleteNode.ts`) which does optimistic cache removal and navigates to the next node.


## Plan of Work

This plan has three implementation milestones plus a validation step. Each milestone builds on the previous and is independently testable.


### Milestone 1: Verify `gh pr view` behavior for merged PRs

Before writing any code, we need to confirm that `gh pr view` still returns PR data when the branch has been deleted from the remote. This is critical because the current code at `src/lib/trpc/routers/nodes/utils/github/github.ts` line 86-136 calls `gh pr view` without passing a branch name — it relies on the worktree's tracking ref. If the remote branch is deleted, the tracking ref may become stale and `gh pr view` might return "no pull requests found" instead of the merged PR data.

To test this, find any repository where you have a merged PR with a deleted branch. Run:

    cd <worktree-path-for-that-branch>
    gh pr view --json number,title,url,state,isDraft,mergedAt
    # Expected: JSON with "state": "MERGED" and a valid mergedAt timestamp

If `gh pr view` fails (returns "no pull requests found"), we need a fallback approach: use `gh pr list --head <branch-name> --state merged --json ...` to find the PR by branch name instead. Document the outcome in Surprises & Discoveries.

If the spike confirms that `gh pr view` works for merged PRs (which is the expected behavior since `gh` tracks PRs by the local branch's push tracking, not by remote existence), proceed to Milestone 2.


### Milestone 2: Add merged badge to sidebar NodeRow

This milestone adds a small purple merge icon next to the node name in the sidebar when the node's PR is merged. The icon uses the existing `PRIcon` component with `state="merged"`.

The file to edit is `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx`.

Currently, `NodeRow` already lazy-loads GitHub status on hover (line 34-40) and extracts `pr` from the response (line 42). We need to render the `PRIcon` component when `pr?.state === "merged"`.

Add the `PRIcon` import at the top of the file, alongside the existing icon imports:

    import { PRIcon } from "renderer/screens/main/components/PRIcon";

Then, in the JSX between the node name `<span>` (line 105-109) and the unread indicator (line 112-117), add a conditional render for the merged badge:

    {pr?.state === "merged" && (
        <PRIcon state="merged" className="size-3.5 shrink-0" />
    )}

This will show a small purple git-merge icon inline with the node name whenever the hover-fetched GitHub status indicates the PR was merged. The icon is the same `LuGitMerge` icon already used by `PRIcon` for the merged state, colored `text-violet-500`.

Since this relies on hover-triggered data, the badge only appears after the user has hovered at least once. This is acceptable — the Changes panel banner (Milestone 3) is the primary indicator for the active node.

Verify by running:

    bun run typecheck
    # Expected: No errors


### Milestone 3: Add merged banner to ChangesView

This is the primary user-facing change. When the active node's PR is merged, a banner appears at the top of the Changes panel (below the header, above the commit input) showing "PR #N was merged" with a "Delete Node" button.

Two files need changes:

**File 1: `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx`**

This component already fetches `githubStatus` at line 59-66 with a 10-second polling interval. We need to:

1. Extract the merged state from `githubStatus`.
2. Render a banner component when the PR is merged.
3. Wire the "Delete Node" button to open the existing `DeleteNodeDialog`.

First, add the necessary imports at the top of the file. We need `PRIcon` for the merge icon, and `DeleteNodeDialog` for the cleanup action:

    import { PRIcon } from "renderer/screens/main/components/PRIcon";
    import { DeleteNodeDialog } from "renderer/screens/main/components/NodesListView/components/DeleteNodeDialog";

Add a `useState` for controlling the delete dialog visibility. Place it near the other `useState` calls (around line 176-177):

    const [showMergedDeleteDialog, setShowMergedDeleteDialog] = useState(false);

Compute the merged state from `githubStatus`. Place this near lines 304-305 where `hasExistingPR` and `prUrl` are already derived:

    const isMerged = githubStatus?.pr?.state === "merged";
    const mergedPrNumber = githubStatus?.pr?.number;
    const mergedPrUrl = githubStatus?.pr?.url;

Insert the banner JSX between the `<ChangesHeader>` (line 309-323) and the `<CommitInput>` (line 325-334). The banner should be a simple `div` with a background color, the merge icon, text, and two buttons (one to delete, one to open the PR on GitHub):

    {isMerged && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border-b border-border">
            <PRIcon state="merged" className="size-4 shrink-0" />
            <span className="text-xs text-foreground/80 flex-1">
                PR #{mergedPrNumber} was merged
            </span>
            {mergedPrUrl && (
                <a
                    href={mergedPrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    View
                </a>
            )}
            <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowMergedDeleteDialog(true)}
            >
                Delete Node
            </Button>
        </div>
    )}

At the bottom of the component, before the closing `</div>` of the root element (but after the existing `AlertDialog` elements, around line 581), add the `DeleteNodeDialog`:

    {workspaceId && (
        <DeleteNodeDialog
            nodeId={workspaceId}
            nodeName={workspace?.name ?? ""}
            nodeType="worktree"
            open={showMergedDeleteDialog}
            onOpenChange={setShowMergedDeleteDialog}
        />
    )}

This reuses the existing delete dialog, which already handles all the complexity: checking for uncommitted changes, unpushed commits, active terminals, and providing "Hide" vs "Delete" options with appropriate warnings.

**File 2: No changes needed to `CommitInput.tsx`**

The `CommitInput` component receives `hasExistingPR` and `prUrl` as props and uses them to show "Open Pull Request" vs "Create Pull Request" in its dropdown. When a PR is merged, `hasExistingPR` will be `true` (the PR object exists with `state: "merged"`), so the dropdown will correctly show "Open Pull Request". This is the right behavior — the user can still view the merged PR on GitHub.

Verify by running:

    bun run typecheck
    # Expected: No errors

    bun run lint
    # Expected: No errors (or only pre-existing warnings)


### Milestone 4: Validation and acceptance

This milestone verifies the complete feature works end-to-end.

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

1. Open a repository that has a merged PR. Create a node for the branch that was merged. If you do not have one readily available, create a branch, push it, open a PR on GitHub, merge it, and delete the branch.

2. Switch to that node in Caspian. After up to 10 seconds (the polling interval), the Changes panel should show the purple "PR #N was merged" banner with a "Delete Node" button and a "View" link.

3. Hover over the node in the sidebar. A small purple merge icon should appear next to the node name.

4. Click "View" in the banner. It should open the merged PR page on GitHub in your browser.

5. Click "Delete Node" in the banner. The existing delete dialog should open, showing the usual warnings about uncommitted changes, active terminals, etc. Confirming the deletion should remove the node and its worktree.

6. Test the dismiss scenario: create another node for a merged PR, observe the banner, and simply navigate away. The banner should reappear when you switch back to that node (since the PR state hasn't changed).


## Concrete Steps

All commands should be run from the repository root (`/Volumes/Samsung T7/Caspian/`).

    # After all edits:
    bun run typecheck
    # Expected: No errors

    bun run lint
    # Expected: No errors

    bun test
    # Expected: All tests pass

    bun dev
    # Launch the app and verify manually as described in Milestone 4


## Validation and Acceptance

The feature is complete when all of the following are true:

1. Running `bun run typecheck` produces no type errors.
2. Running `bun run lint` produces no lint errors.
3. Running `bun test` produces no test failures.
4. In the running app (`bun dev`), switching to a node whose PR has been merged shows a purple "PR #N was merged" banner in the Changes panel within 10 seconds.
5. The banner includes a "Delete Node" button that opens the standard delete dialog.
6. The banner includes a "View" link that opens the PR on GitHub.
7. Hovering over a node with a merged PR in the sidebar shows a purple merge icon next to the node name.
8. Nodes whose PRs are not merged (open, draft, closed, or no PR) show no banner and no badge.


## Idempotence and Recovery

All changes are purely additive: new JSX, new imports, new state variables. No existing behavior is modified. Running the implementation steps multiple times is safe. If the implementation fails partway through, the app will still function correctly — the worst case is a partial UI that shows the badge but not the banner, or vice versa.

If `gh pr view` does not work for merged PRs (Milestone 1 spike fails), the entire approach remains valid but requires a small change to the `getPRForBranch` function in `src/lib/trpc/routers/nodes/utils/github/github.ts` to use a fallback query. This would be documented in the Decision Log and the plan updated accordingly.


## Artifacts and Notes

The existing `PRIcon` component already handles the merged state:

    // src/renderer/screens/main/components/PRIcon/PRIcon.tsx
    if (state === "merged") {
        return <LuGitMerge className={baseClass} />;
    }
    // Renders a purple (text-violet-500) git merge icon

The existing `usePRStatus` hook already returns `branchExistsOnRemote`:

    // src/renderer/screens/main/hooks/usePRStatus/usePRStatus.ts
    return {
        pr: githubStatus?.pr ?? null,
        repoUrl: githubStatus?.repoUrl ?? null,
        branchExistsOnRemote: githubStatus?.branchExistsOnRemote ?? false,
        isLoading,
        refetch,
    };

The `DeleteNodeDialog` component (`src/renderer/screens/main/components/NodesListView/components/DeleteNodeDialog/DeleteNodeDialog.tsx`) accepts these props:

    {
        nodeId: string
        nodeName: string
        nodeType?: "worktree" | "branch"
        open: boolean
        onOpenChange: (open: boolean) => void
    }


## Interfaces and Dependencies

No new libraries or dependencies are needed. All components used already exist:

- `PRIcon` from `src/renderer/screens/main/components/PRIcon/PRIcon.tsx`
- `DeleteNodeDialog` from `src/renderer/screens/main/components/NodesListView/components/DeleteNodeDialog/DeleteNodeDialog.tsx`
- `Button` from `src/ui/components/ui/button.tsx`
- `electronTrpc.nodes.getGitHubStatus` tRPC query (already called in `ChangesView.tsx`)

No new tRPC procedures are needed. No database schema changes are needed. The `GitHubStatus` type already contains `pr.state: "merged"` and `branchExistsOnRemote: boolean`.

The only new code is renderer-side JSX in two files:

1. `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx` — one import, one JSX fragment
2. `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx` — two imports, one state variable, three computed values, one JSX banner, one dialog instance
