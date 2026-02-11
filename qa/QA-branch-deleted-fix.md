# Manual QA: branch-deleted-fix

> Generated from changes in `branch-deleted-fix` branch.
> Check off items as you verify them. Delete categories that don't apply.

---

## Change-Specific QA

> These items are specific to the changes in this branch. Written from the diff.

### New node (never pushed)

- [ ] Create a new node from an existing repository. Open the Changes panel. The amber "Branch deleted on remote" banner should NOT appear.
- [ ] Create a new node. Hover over the node row in the sidebar. The cloud-off icon (LuCloudOff) should NOT appear.
- [ ] Create a new node, wait at least 10 seconds (one full GitHub status poll cycle), and confirm the banner still does not appear.
- [ ] Create a new node, switch away to another node, then switch back. The banner should still not appear.

### Branch pushed and still exists on remote

- [ ] Switch to a node whose branch has been pushed and still exists on the remote (e.g., has an open PR). The "Branch deleted on remote" banner should NOT appear.
- [ ] Hover over that node in the sidebar. The cloud-off icon should NOT appear.

### Branch pushed then deleted on remote (the intended scenario)

- [ ] Have a node whose branch was pushed, then delete the remote branch (e.g., merge a PR on GitHub with auto-delete branch enabled). Wait for the 10-second poll. The amber "Branch deleted on remote" banner SHOULD appear in the Changes panel with "Push to Restore" and "Delete Node" buttons.
- [ ] Hover over that node in the sidebar. The cloud-off icon SHOULD appear.
- [ ] Click "Push to Restore" on the banner. The branch should be re-pushed to the remote, and the banner should disappear after the next poll.
- [ ] Repeat the deletion scenario. Click "Delete Node" instead. The node should be deleted properly.

### Merged PR scenario

- [ ] Switch to a node whose PR was merged. The purple "PR #N was merged" banner should appear instead of the amber "Branch deleted on remote" banner, even though the remote branch is gone.
- [ ] Hover over that node in the sidebar. The cloud-off icon should NOT appear (merged state takes priority).

### Backward compatibility with cached data

- [ ] If you have an existing database with cached `githubStatus` records that lack the `branchHasBeenPushed` field, the app should not crash. The field should default to `false`, meaning no banner shows until a fresh fetch occurs.
- [ ] After a fresh fetch, the field should be populated correctly.

### Edge cases

- [ ] Create a node, manually push the branch from a terminal (`git push --set-upstream origin <branch>`), then delete the remote branch via GitHub. The banner SHOULD now appear (the push created the upstream config).
- [ ] For a branch-only node (not backed by a worktree), confirm no crashes or unexpected behavior when GitHub status is queried.

---

## General Categories

### Electron App -- General

- [ ] App launches without errors
- [ ] No console errors in DevTools (main + renderer) related to branchHasBeenPushed
- [ ] Feature works after app restart

### tRPC over Electron IPC

- [ ] `getGitHubStatus` tRPC query returns `branchHasBeenPushed` field in the response
- [ ] No type mismatches between main/renderer for the new field

### Node/Worktree

- [ ] Node creation completes full init sequence (pending -> ready) without being affected by the new check
- [ ] Node switching preserves state
- [ ] Node deletion from the "Branch deleted on remote" banner cleans up properly

### Performance & UX

- [ ] No jank or delay from the added `git config --get` call in the 10-second polling loop
- [ ] The three parallel checks (`branchExistsOnRemote`, `getPRForBranch`, `branchHasBeenPushed`) complete without noticeable latency increase
- [ ] Sidebar hover-to-load GitHub status still feels instant

### Observability & Logging

- [ ] No noisy logs from the `branchHasBeenPushed` check on every poll cycle
- [ ] If `git config --get` fails (e.g., corrupt git config), it silently returns `false` without error logs
