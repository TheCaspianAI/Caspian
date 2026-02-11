# Fix "Branch deleted on remote" banner showing for never-pushed branches

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md.


## Purpose / Big Picture

When a user creates a new node in Caspian, the "Branch deleted on remote" banner immediately appears in the Changes panel with "Push to Restore" and "Delete Node" buttons. This is a major UX problem: the branch was never pushed to a remote — it was not "deleted," it simply does not exist there yet. The banner is alarming and misleading for brand-new work.

After this fix, the banner will only appear when a branch was previously published to a remote and then deleted (the scenario it was designed for). New nodes with local-only branches will not show the banner or the cloud-off icon in the sidebar.


## Assumptions

1. The `gh` CLI tool sets up upstream tracking when branches are pushed via `git push --set-upstream origin <branch>`. This means `git config --get branch.<name>.remote` returns "origin" for any branch that has been pushed at least once.

2. The local branch tracking config (`branch.<name>.remote` and `branch.<name>.merge` in `.git/config`) persists even after the remote branch is deleted and `git fetch --prune` is run. Only an explicit `git branch --unset-upstream <name>` removes it.

3. Checking `git config --get branch.<name>.remote` is a local operation with negligible latency — safe to include in a 10-second polling loop.


## Open Questions

None — the approach is straightforward and well-understood.


## Progress

- [ ] Add `branchHasBeenPushed` helper to `src/lib/trpc/routers/nodes/utils/git.ts`
- [ ] Call helper in `fetchGitHubPRStatus` and include result in `GitHubStatus`
- [ ] Add `branchHasBeenPushed` field to `gitHubStatusSchema` in `src/lib/local-db/schema/zod.ts`
- [ ] Update banner condition in `ChangesView.tsx` to require `branchHasBeenPushed`
- [ ] Update icon condition in `NodeRow.tsx` to require `branchHasBeenPushed`
- [ ] Run typecheck, lint, and verify in dev


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Use `git config --get branch.<name>.remote` to determine if a branch has been pushed, rather than reusing `hasUpstream` from the changes status query.
  Rationale: The changes status computes `hasUpstream` via `git rev-parse --abbrev-ref @{upstream}`, which resolves the upstream ref. If `git fetch --prune` has removed the remote tracking ref (`origin/branchname`), this resolution fails and `hasUpstream` returns false — even though the branch was previously pushed. By contrast, `git config --get branch.<name>.remote` reads the local branch config, which persists across prune operations. This makes it the more reliable signal for "has this branch ever been published." Additionally, `hasUpstream` is only available in the changes status query (used by `ChangesView`), not in the GitHub status query (used by `NodeRow` in the sidebar). Adding the check to `GitHubStatus` serves both consumers from a single source.
  Date: 2026-02-11

- Decision: Add a new boolean field `branchHasBeenPushed` to the `GitHubStatus` type rather than modifying `branchExistsOnRemote` semantics.
  Rationale: `branchExistsOnRemote` accurately answers "does the branch currently exist on the remote?" — that meaning should not change. The new field answers a different question: "has this branch ever been configured to track a remote?" Keeping both fields preserves the original semantics and lets the renderer combine them for the correct UX logic.
  Date: 2026-02-11


## Outcomes & Retrospective

Implemented as planned. All five files modified, plus an additional optimistic update in `ChangesView.tsx` to dismiss the banner instantly after "Push to Restore" (the server-side 10-second cache was causing a stale delay). Typecheck clean (pre-existing `resizable.tsx` errors only), lint clean, all 447 tests pass. Verified in `bun dev` that new nodes no longer show the banner.


## Context and Orientation

Caspian is an Electron desktop app. The main process (Node.js, `src/main/`) and renderer process (browser/React, `src/renderer/`) communicate via tRPC over IPC. The tRPC procedure definitions live in `src/lib/trpc/routers/`.

The "branch deleted on remote" feature was added recently. It polls GitHub status every 10 seconds via a tRPC query and shows a warning banner when a branch no longer exists on the remote. The problem is that "does not exist on remote" is also the default state of any local-only branch that has never been pushed.

Key files involved, all relative to the repository root:

- `src/lib/trpc/routers/nodes/utils/git.ts` — Git utility functions including `branchExistsOnRemote`, which runs `git ls-remote --exit-code --heads origin <branch>` and returns `"exists"`, `"not_found"`, or `"error"`.

- `src/lib/trpc/routers/nodes/utils/github/github.ts` — The `fetchGitHubPRStatus` function, which is called every 10 seconds. It fetches the repo URL, branch name, checks if the branch exists on remote, and gets PR info. Returns a `GitHubStatus` object stored in the database.

- `src/lib/local-db/schema/zod.ts` — Zod schemas for database types. `gitHubStatusSchema` defines the shape of `GitHubStatus` including `branchExistsOnRemote: boolean`.

- `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx` — The Changes panel that shows the amber "Branch deleted on remote" banner. The condition on line 324-325 is: `githubStatus != null && !githubStatus.branchExistsOnRemote && !isMerged`.

- `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx` — The sidebar node row that shows a cloud-off icon. The condition on line 45-46 is: `githubStatus != null && !githubStatus.branchExistsOnRemote && pr?.state !== "merged"`.

The root cause: `branchExistsOnRemote` returns `false` for two distinct scenarios that need different treatment:
1. The branch has never been pushed (new local branch) — should NOT show the banner
2. The branch was pushed but then deleted from the remote (e.g., after PR merge) — SHOULD show the banner

The fix distinguishes these by checking whether the branch has upstream tracking configuration, which is set when a branch is first pushed with `--set-upstream`.


## Plan of Work

The fix touches five files across two layers (shared tRPC code and renderer components). No database migration is needed because `githubStatus` is stored as a JSON blob in the `worktrees` table — adding a field to the Zod schema is sufficient.

### 1. Add a helper function to check if a branch has been pushed

In `src/lib/trpc/routers/nodes/utils/git.ts`, add a function `branchHasBeenPushed` near the existing `branchExistsOnRemote` function (around line 934). The function takes a `worktreePath` and `branchName`, runs `git config --get branch.<branchName>.remote`, and returns `true` if it succeeds (the branch has tracking config) or `false` if it fails (no tracking config, meaning the branch was never pushed).

    export async function branchHasBeenPushed(
      worktreePath: string,
      branchName: string,
    ): Promise<boolean> {
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["-C", worktreePath, "config", "--get", `branch.${branchName}.remote`],
          { timeout: 5_000 },
        );
        return stdout.trim().length > 0;
      } catch {
        // Exit code 1 means the key doesn't exist — branch was never pushed
        return false;
      }
    }

This uses the existing `execFileAsync` (from `node:child_process` promisified) that is already imported at the top of the file.

### 2. Call the helper in `fetchGitHubPRStatus`

In `src/lib/trpc/routers/nodes/utils/github/github.ts`, update the `fetchGitHubPRStatus` function. Import `branchHasBeenPushed` alongside the existing `branchExistsOnRemote` import from `"../git"`. Add the `branchHasBeenPushed` call to the existing `Promise.all` on line 42-45, so all three checks (remote existence, PR info, push history) run in parallel:

    const [branchCheck, prInfo, hasBeenPushed] = await Promise.all([
      branchExistsOnRemote(worktreePath, branchName),
      getPRForBranch(worktreePath, branchName),
      branchHasBeenPushed(worktreePath, branchName),
    ]);

Then include the new field in the result object on line 51-56:

    const result: GitHubStatus = {
      pr: prInfo,
      repoUrl,
      branchExistsOnRemote: existsOnRemote,
      branchHasBeenPushed: hasBeenPushed,
      lastRefreshed: Date.now(),
    };

### 3. Update the Zod schema

In `src/lib/local-db/schema/zod.ts`, add `branchHasBeenPushed: z.boolean()` to the `gitHubStatusSchema` object, right after the `branchExistsOnRemote` field on line 44. Since the `GitHubStatus` type is inferred from this schema, the TypeScript type updates automatically.

However, existing cached records in the database won't have this field. To handle backward compatibility, make the field optional with a default: `branchHasBeenPushed: z.boolean().default(false)`. This means if an old cached record is read from the database without the field, it defaults to `false` — which is the safe default (it will not show the banner for old cached data until a fresh fetch occurs).

### 4. Update the banner condition in ChangesView

In `src/renderer/screens/main/components/ContextRail/ChangesView/ChangesView.tsx`, change line 324-325 from:

    const isBranchDeletedOnRemote =
      githubStatus != null && !githubStatus.branchExistsOnRemote && !isMerged;

to:

    const isBranchDeletedOnRemote =
      githubStatus != null &&
      !githubStatus.branchExistsOnRemote &&
      githubStatus.branchHasBeenPushed &&
      !isMerged;

The new condition `githubStatus.branchHasBeenPushed` ensures the banner only appears when the branch was previously published. For a new local-only branch, `branchHasBeenPushed` is `false`, so the entire expression evaluates to `false` and the banner does not render.

### 5. Update the icon condition in NodeRow

In `src/renderer/screens/main/components/NodesListView/NodeRow/NodeRow.tsx`, change line 45-46 from:

    const isBranchDeletedOnRemote =
      githubStatus != null && !githubStatus.branchExistsOnRemote && pr?.state !== "merged";

to:

    const isBranchDeletedOnRemote =
      githubStatus != null &&
      !githubStatus.branchExistsOnRemote &&
      githubStatus.branchHasBeenPushed &&
      pr?.state !== "merged";


## Concrete Steps

Run typecheck to verify no type errors:

    bun run typecheck
    # Expected: No errors

Run lint to verify code quality:

    bun run lint
    # Expected: No lint errors

Run tests:

    bun test
    # Expected: All tests pass

Launch the dev app and verify:

    bun dev
    # Expected: Electron app opens


## Validation and Acceptance

After implementing all changes, verify the fix by launching the app with `bun dev`:

1. Create a new node from an existing repository. Navigate to the Changes panel. The "Branch deleted on remote" amber banner should NOT appear. The sidebar should NOT show the cloud-off icon for this node.

2. For an existing node whose branch has been pushed and still exists on the remote, the banner should NOT appear (branch exists on remote, so `branchExistsOnRemote` is `true`).

3. For an existing node whose branch was pushed and then deleted from the remote (e.g., after merging a PR on GitHub), the banner SHOULD appear with "Push to Restore" and "Delete Node" buttons. The sidebar SHOULD show the cloud-off icon.

Run code quality checks:

    bun run typecheck   # No type errors
    bun run lint        # No lint errors
    bun test            # All tests pass


## Idempotence and Recovery

All changes are additive or are modifications to existing conditions. The Zod schema change uses `.default(false)` for backward compatibility with existing database records. Running the steps multiple times produces the same result. If anything goes wrong, reverting the five file changes restores the previous behavior.


## Artifacts and Notes

The git command used to check push history:

    git config --get branch.<branchName>.remote
    # Returns "origin" (or another remote name) if the branch has been pushed
    # Exit code 1 if the key doesn't exist (branch never pushed)

This is a local-only operation — it reads from `.git/config` and does not contact any remote server.


## Interfaces and Dependencies

No new dependencies. The fix uses `execFileAsync` (already imported in `git.ts` from `node:child_process`) and the existing `GitHubStatus` Zod schema.

New function signature added to `src/lib/trpc/routers/nodes/utils/git.ts`:

    export async function branchHasBeenPushed(
      worktreePath: string,
      branchName: string,
    ): Promise<boolean>

Updated `GitHubStatus` type (inferred from Zod schema in `src/lib/local-db/schema/zod.ts`):

    {
      pr: { ... } | null;
      repoUrl: string;
      branchExistsOnRemote: boolean;
      branchHasBeenPushed: boolean;   // NEW — defaults to false for old cached records
      lastRefreshed: number;
    }
