# Manual QA Checklist Generator

You are an expert Caspian QA engineer creating a comprehensive manual QA checklist for the current changes.

## Workflow

### 1. Inspect the current changes

Run these commands to understand what changed:

- `git status` to see modified/untracked files
- `git diff` to see unstaged changes
- `git diff --staged` to see staged changes
- `git branch --show-current` to get the current branch name

### 2. Analyze the changes

Read every changed file to understand:

- What domains are affected (terminal, nodes, UI, database, tRPC, etc.)
- What user-facing behavior changed
- What edge cases exist
- What could break

### 3. Create the QA file

Create the file at `qa/QA-<branch-name>.md` where `<branch-name>` is the current git branch.

If the `qa/` directory doesn't exist, create it.

### 4. Write the checklist

Use the template below. Include ALL QA categories — the tester will delete what's not relevant.

For the **Change-Specific QA** section at the top, write detailed, specific checklist items based on the actual diff. These should be concrete scenarios, not generic. Reference specific UI elements, specific inputs, specific flows.

---

## QA File Template

```markdown
# Manual QA: <branch-name>

> Generated from changes in `<branch-name>` branch.
> Check off items as you verify them. Delete categories that don't apply.

---

## Change-Specific QA

> These items are specific to the changes in this branch. Written from the diff.

- [ ] ...
- [ ] ...
- [ ] ...

---

## General Categories

### Electron App — General

- [ ] App launches without errors
- [ ] No console errors in DevTools (main + renderer)
- [ ] Feature works after app restart
- [ ] No Node.js imports in renderer or shared code

### tRPC over Electron IPC

- [ ] tRPC router changes validated from renderer call-sites
- [ ] Subscriptions use `observable` pattern (not async generators)
- [ ] Error cases return appropriate tRPC error codes
- [ ] No type mismatches between main/renderer

### Terminal Features

- [ ] Terminal spawns correctly
- [ ] Terminal resize works
- [ ] Cmd+click on file paths works
- [ ] Terminal persists across workspace switches

### Node/Worktree

- [ ] Node creation completes full init sequence (pending -> ready)
- [ ] Worktree created at correct path
- [ ] Node switching preserves state
- [ ] Node deletion cleans up properly (soft delete via deletingAt)
- [ ] Works for both worktree-backed and branch-only nodes

### File Operations

- [ ] File reading handles large files gracefully
- [ ] Binary files detected and handled
- [ ] File saving writes to correct path
- [ ] Dirty state indicator works

### UI State Persistence

- [ ] Setting persists after app restart
- [ ] UI state (collapsed sections, widths) persists
- [ ] Active workspace remembered

### Packaging & Updates

- [ ] Packaged build launches (`bun run build` then test .app/.dmg)
- [ ] Native modules load correctly (node-pty, better-sqlite3)
- [ ] Auto-updater doesn't crash (if touching update logic)
- [ ] Dev mode and packaged mode both work

### Database Migrations — Migration Safety

- [ ] Migration applies cleanly on fresh DB
- [ ] Migration applies cleanly on existing data
- [ ] Rollback works (if applicable, note if forward-only)
- [ ] Existing data preserved and valid

### Database Migrations — Schema Changes

- [ ] New columns have sensible defaults
- [ ] Indexes added for query patterns
- [ ] No breaking changes to existing queries

### Security & Privacy

- [ ] No sensitive data in logs (tokens, passwords, PII)
- [ ] Error messages don't leak internal details
- [ ] No secrets committed to repo

### Performance & UX

- [ ] No jank on navigation or interactions
- [ ] Loading states appear quickly
- [ ] Large lists/files don't freeze UI
- [ ] Terminal throughput acceptable
- [ ] File tree renders smoothly with many files
- [ ] App startup time reasonable

### Observability & Logging

- [ ] Logs are prefixed with context (e.g., `[workspace/create]`)
- [ ] Errors include relevant IDs and context
- [ ] No noisy logs in hot paths
- [ ] Sensitive data excluded from logs

### UI Components — Rendering

- [ ] Component renders without errors
- [ ] Props are typed correctly
- [ ] Loading states work

### UI Components — Interactions

- [ ] Click handlers fire correctly
- [ ] Keyboard navigation works
- [ ] Focus management is correct

### UI Components — Accessibility

- [ ] Keyboard-only navigation works
- [ ] Focus indicators visible
- [ ] Screen reader semantics correct (if applicable)

### UI Components — Responsive

- [ ] Works at different viewport sizes
- [ ] No layout breaks
```

---

## Guidelines

- The **Change-Specific QA** section is the most important part. Spend time reading the diff carefully and writing specific, actionable test scenarios. Include happy paths, edge cases, and error states.
- Keep checklist items concise but specific enough that someone unfamiliar with the change could follow them.
- If the diff touches multiple features, group change-specific items under sub-headings.
- After writing the file, print the file path so the user knows where to find it.
