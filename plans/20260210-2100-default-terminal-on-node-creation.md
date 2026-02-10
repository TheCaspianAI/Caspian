# Open a default terminal when a new node is created

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md.

## Purpose / Big Picture

When a user creates a new node in Caspian today, if they have no setup script and no default terminal preset configured, they land on an empty node with no terminal tab. They have to manually add a terminal tab before they can start working. After this change, every new node will always have at least one terminal tab open when it becomes ready, so the user can start working immediately.

## Assumptions

- A single default terminal tab (no initial commands) is sufficient for the fallback case. Nodes with setup scripts or presets already create terminals and need no change.

## Open Questions

None.

## Progress

- [ ] Modify fallback case in `handleTerminalSetup`
- [ ] Verify with `bun run typecheck` and `bun run lint`

## Surprises & Discoveries

(None yet.)

## Decision Log

(None yet.)

## Outcomes & Retrospective

(To be filled at completion.)

## Context and Orientation

**Process affected:** Renderer only.

**How terminal tabs get created for new nodes:** When a node's initialization reaches the "ready" step, the `NodeInitEffects` component (`src/renderer/screens/main/components/NodeInitEffects.tsx`) runs `handleTerminalSetup()`. This function has four branches:

1. Setup script + default preset → creates tabs for both
2. Setup script only → creates one "Node Setup" tab
3. Default preset only → creates preset tabs
4. **Neither → does nothing** (line 150-152)

Branch 4 is the problem. It calls `onComplete()` without creating any tab.

## Plan of Work

Edit `src/renderer/screens/main/components/NodeInitEffects.tsx`, in the `handleTerminalSetup` callback.

Replace the final fallback block (lines 150-152):

```typescript
// No setup script and no default preset - that's fine, user can configure
// scripts during node creation in Advanced Options if they want
onComplete();
```

With a block that creates a default terminal tab:

```typescript
addTab(setup.nodeId);
onComplete();
```

This calls the same `addTab` used in the other branches. It creates a tab with one terminal pane. No `initialCommands` means the terminal opens with a plain shell in the worktree directory. The terminal connection itself happens later when the `Terminal` component mounts and calls `createOrAttach`.

No other files need to change.

## Validation and Acceptance

    bun run typecheck   # No type errors
    bun run lint        # No lint errors

Manual verification:

1. Run `bun dev`
2. Create a new node with no setup script and no default preset configured
3. When the node becomes ready, it should have a terminal tab open automatically
4. The terminal should be functional with the shell in the worktree directory

## Idempotence and Recovery

This change is safe to apply multiple times — it only modifies a single code path. If the `addTab` call fails, the behavior degrades to the current state (no tab).
