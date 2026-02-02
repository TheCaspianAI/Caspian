# Settings Rebrand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand the entire codebase from workspace/project terminology to node/repository, and consolidate settings into a cleaner 4-category structure.

**Architecture:** This is a large-scale rename refactor that maintains all existing functionality while changing terminology. We'll work layer by layer: database schema → tRPC → stores → components → routes → UI text.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Zustand, React, TanStack Router

---

## Task 1: Rename Database Schema - Tables and Types

**Files:**
- Modify: `src/lib/local-db/schema/schema.ts`
- Modify: `src/lib/local-db/schema/relations.ts`
- Modify: `src/lib/local-db/schema/zod.ts`

**Step 1: Update schema.ts**

Rename `projects` table to `repositories`:
```typescript
// Change: export const projects = sqliteTable("projects", ...
// To:
export const repositories = sqliteTable("repositories", {
    // ... same fields, rename projectId references
});

// Change type exports
export type InsertRepository = typeof repositories.$inferInsert;
export type SelectRepository = typeof repositories.$inferSelect;
```

Rename `workspaces` table to `nodes`:
```typescript
// Change: export const workspaces = sqliteTable("workspaces", ...
// To:
export const nodes = sqliteTable("nodes", {
    // ... same fields
    repositoryId: text("repository_id")  // was projectId
        .notNull()
        .references(() => repositories.id, { onDelete: "cascade" }),
    // ... rest of fields
});

export type InsertNode = typeof nodes.$inferInsert;
export type SelectNode = typeof nodes.$inferSelect;
```

Update `settings` table field:
```typescript
// Change: lastActiveWorkspaceId → lastActiveNodeId
lastActiveNodeId: text("last_active_node_id"),
```

**Step 2: Update relations.ts**

```typescript
export const repositoriesRelations = relations(repositories, ({ many }) => ({
    worktrees: many(worktrees),
    nodes: many(nodes),
}));

export const worktreesRelations = relations(worktrees, ({ one, many }) => ({
    repository: one(repositories, {
        fields: [worktrees.repositoryId],
        references: [repositories.id],
    }),
    nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one }) => ({
    repository: one(repositories, {
        fields: [nodes.repositoryId],
        references: [repositories.id],
    }),
    worktree: one(worktrees, {
        fields: [nodes.worktreeId],
        references: [worktrees.id],
    }),
}));
```

**Step 3: Update zod.ts**

```typescript
// Change: workspaceTypeSchema → nodeTypeSchema
export const nodeTypeSchema = z.enum(["worktree", "branch"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;
```

**Step 4: Verify compilation**

Run: `cd /Volumes/Samsung\ T7/SuperSet/superset/apps/caspian && npx tsc --noEmit 2>&1 | head -50`

---

## Task 2: Rename tRPC Routers - Workspaces to Nodes

**Files:**
- Rename: `src/lib/trpc/routers/workspaces/` → `src/lib/trpc/routers/nodes/`
- Modify: `src/lib/trpc/routers/nodes/nodes.ts` (was workspaces.ts)
- Modify: `src/lib/trpc/routers/nodes/index.ts`
- Modify all files in `src/lib/trpc/routers/nodes/procedures/`
- Modify all files in `src/lib/trpc/routers/nodes/utils/`

**Step 1: Rename directory and main files**

```bash
mv src/lib/trpc/routers/workspaces src/lib/trpc/routers/nodes
mv src/lib/trpc/routers/nodes/workspaces.ts src/lib/trpc/routers/nodes/nodes.ts
```

**Step 2: Update nodes/index.ts**

```typescript
export type { NodesRouter } from "./nodes";
export { createNodesRouter } from "./nodes";
```

**Step 3: Update nodes/nodes.ts**

```typescript
export const createNodesRouter = () => {
    return mergeRouters(
        createCreateProcedures(),
        createDeleteProcedures(),
        createQueryProcedures(),
        createBranchProcedures(),
        createGitStatusProcedures(),
        createStatusProcedures(),
        createInitProcedures(),
    );
};

export type NodesRouter = ReturnType<typeof createNodesRouter>;
```

**Step 4: Update all procedure files**

In each procedure file, update:
- Import `nodes` instead of `workspaces` from schema
- Change all `workspaceId` to `nodeId`
- Change all `workspace` variable names to `node`
- Update function names if they contain "workspace"

**Step 5: Update utility files**

Similar renames in:
- `utils/db-helpers.ts`
- `utils/setup.ts`
- `utils/teardown.ts`
- `utils/workspace-init.ts` → `utils/node-init.ts`

---

## Task 3: Rename tRPC Routers - Projects to Repositories

**Files:**
- Rename: `src/lib/trpc/routers/projects/` → `src/lib/trpc/routers/repositories/`
- Modify: `src/lib/trpc/routers/repositories/repositories.ts` (was projects.ts)
- Modify: `src/lib/trpc/routers/repositories/index.ts`

**Step 1: Rename directory and files**

```bash
mv src/lib/trpc/routers/projects src/lib/trpc/routers/repositories
mv src/lib/trpc/routers/repositories/projects.ts src/lib/trpc/routers/repositories/repositories.ts
```

**Step 2: Update all references**

- Change `projectId` → `repositoryId`
- Change `project` variables → `repository`
- Update function name: `createProjectsRouter` → `createRepositoriesRouter`
- Update type: `ProjectsRouter` → `RepositoriesRouter`

---

## Task 4: Update Main Router Registration

**Files:**
- Modify: `src/lib/trpc/routers/index.ts`

**Step 1: Update imports and router registration**

```typescript
import { createNodesRouter } from "./nodes";
import { createRepositoriesRouter } from "./repositories";

export const createAppRouter = (getWindow: () => BrowserWindow | null) => {
    return router({
        // ... other routers
        repositories: createRepositoriesRouter(getWindow),
        nodes: createNodesRouter(),
        // ... rest
    });
};
```

---

## Task 5: Rename Zustand Stores

**Files:**
- Modify: `src/renderer/stores/settings-state.ts`
- Rename: `src/renderer/stores/workspace-sidebar-state.ts` → `src/renderer/stores/node-sidebar-state.ts`
- Rename: `src/renderer/stores/workspace-init.ts` → `src/renderer/stores/node-init.ts`
- Rename: `src/renderer/stores/new-workspace-modal.ts` → `src/renderer/stores/new-node-modal.ts`
- Modify: `src/renderer/stores/index.ts`

**Step 1: Update settings-state.ts**

```typescript
export type SettingsSection =
    | "appearance"
    | "preferences"  // was ringtones + keyboard + behavior
    | "presets"      // was terminal (partial)
    | "sessions"     // was terminal (partial)
    | "repository"   // was project
    | "node";        // was workspace
```

**Step 2: Rename store files and update contents**

Update all `workspace` references to `node` in:
- Variable names
- Function names
- Type names
- Store names

---

## Task 6: Rename React Query Hooks

**Files:**
- Rename directory: `src/renderer/react-query/workspaces/` → `src/renderer/react-query/nodes/`
- Rename directory: `src/renderer/react-query/projects/` → `src/renderer/react-query/repositories/`
- Update all hook files within

**Step 1: Rename directories**

```bash
mv src/renderer/react-query/workspaces src/renderer/react-query/nodes
mv src/renderer/react-query/projects src/renderer/react-query/repositories
```

**Step 2: Rename individual files**

- `useCreateWorkspace.ts` → `useCreateNode.ts`
- `useDeleteWorkspace.ts` → `useDeleteNode.ts`
- `useUpdateWorkspace.ts` → `useUpdateNode.ts`
- etc.

**Step 3: Update all tRPC calls**

Change: `electronTrpc.workspaces.*` → `electronTrpc.nodes.*`
Change: `electronTrpc.projects.*` → `electronTrpc.repositories.*`

---

## Task 7: Rename Main Screen Components

**Files:**
- Rename: `src/renderer/screens/main/components/WorkspaceSidebar/` → `NodeSidebar/`
- Rename: `src/renderer/screens/main/components/WorkspaceView/` → `NodeView/`
- Rename: `src/renderer/screens/main/components/WorkspacesListView/` → `NodesListView/`
- Update all component names and imports within

**Step 1: Rename component directories**

```bash
mv src/renderer/screens/main/components/WorkspaceSidebar src/renderer/screens/main/components/NodeSidebar
mv src/renderer/screens/main/components/WorkspaceView src/renderer/screens/main/components/NodeView
mv src/renderer/screens/main/components/WorkspacesListView src/renderer/screens/main/components/NodesListView
```

**Step 2: Rename component files**

- `WorkspaceSidebar.tsx` → `NodeSidebar.tsx`
- `WorkspaceListItem.tsx` → `NodeListItem.tsx`
- `WorkspaceHoverCard.tsx` → `NodeHoverCard.tsx`
- `DeleteWorkspaceDialog.tsx` → `DeleteNodeDialog.tsx`
- etc.

**Step 3: Update component names and exports**

In each file, rename the component function and update all internal references.

---

## Task 8: Create Consolidated Preferences Page

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/preferences/page.tsx`
- Create: `src/renderer/routes/_authenticated/settings/preferences/components/PreferencesSettings/PreferencesSettings.tsx`
- Delete: `src/renderer/routes/_authenticated/settings/ringtones/` (after merging)
- Delete: `src/renderer/routes/_authenticated/settings/keyboard/` (after merging)
- Delete: `src/renderer/routes/_authenticated/settings/behavior/` (after merging)

**Step 1: Create PreferencesSettings component**

Combine content from:
- RingtonesSettings (notification sounds)
- Keyboard page (shortcuts)
- BehaviorSettings (quit confirm, branch prefix)
- Link behavior from Terminal

Structure:
```tsx
export function PreferencesSettings() {
    return (
        <div className="space-y-8">
            {/* Notification Sounds Section */}
            {/* Keyboard Shortcuts Section */}
            {/* Confirm Before Quitting Section */}
            {/* Branch Prefix Section */}
            {/* Link Behavior Section */}
        </div>
    );
}
```

---

## Task 9: Create Presets Page (from Terminal)

**Files:**
- Rename: `src/renderer/routes/_authenticated/settings/terminal/` → `presets/`
- Modify: `src/renderer/routes/_authenticated/settings/presets/page.tsx`
- Modify: `src/renderer/routes/_authenticated/settings/presets/components/PresetsSettings/PresetsSettings.tsx`

**Step 1: Extract preset-related content**

Keep in Presets page:
- Terminal presets table
- Quick-add templates (rename to "Agent Templates")
- Auto-apply default preset toggle

Move to Sessions page:
- Active sessions table
- Kill/restart controls

---

## Task 10: Create Sessions Page

**Files:**
- Create: `src/renderer/routes/_authenticated/settings/sessions/page.tsx`
- Create: `src/renderer/routes/_authenticated/settings/sessions/components/SessionsSettings/SessionsSettings.tsx`

**Step 1: Create SessionsSettings component**

Extract from TerminalSettings:
- Active sessions table
- Kill session actions
- Clear history button
- Restart daemon button

---

## Task 11: Rename Settings Routes for Repository/Node

**Files:**
- Rename: `src/renderer/routes/_authenticated/settings/project/` → `repository/`
- Rename: `src/renderer/routes/_authenticated/settings/workspace/` → `node/`
- Update route params: `$projectId` → `$repositoryId`, `$workspaceId` → `$nodeId`

**Step 1: Rename directories**

```bash
mv src/renderer/routes/_authenticated/settings/project src/renderer/routes/_authenticated/settings/repository
mv src/renderer/routes/_authenticated/settings/workspace src/renderer/routes/_authenticated/settings/node
```

**Step 2: Update route files**

Rename parameter files:
- `$projectId/` → `$repositoryId/`
- `$workspaceId/` → `$nodeId/`

---

## Task 12: Update Settings Sidebar Navigation

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx`
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/ProjectsSettings.tsx` → `RepositoriesSettings.tsx`
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/SettingsSidebar.tsx`

**Step 1: Update GeneralSettings.tsx**

```typescript
const GENERAL_SECTIONS = [
    {
        id: "/settings/appearance",
        section: "appearance",
        label: "Appearance",
        icon: <HiOutlinePaintBrush className="h-4 w-4" />,
    },
    {
        id: "/settings/preferences",
        section: "preferences",
        label: "Preferences",
        icon: <HiOutlineAdjustmentsHorizontal className="h-4 w-4" />,
    },
    {
        id: "/settings/presets",
        section: "presets",
        label: "Presets",
        icon: <HiOutlineCommandLine className="h-4 w-4" />,
    },
    {
        id: "/settings/sessions",
        section: "sessions",
        label: "Sessions",
        icon: <HiOutlineSignal className="h-4 w-4" />,
    },
];
```

**Step 2: Rename and update ProjectsSettings → RepositoriesSettings**

- Change section header from "Projects" to "Repositories"
- Update route paths
- Change "workspace" references to "node"

---

## Task 13: Update Settings Search System

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/utils/settings-search/settings-search.ts`

**Step 1: Update SETTING_ITEM_ID**

```typescript
export const SETTING_ITEM_ID = {
    // Appearance (unchanged)
    APPEARANCE_THEME: "appearance-theme",
    APPEARANCE_MARKDOWN: "appearance-markdown",
    APPEARANCE_CUSTOM_THEMES: "appearance-custom-themes",

    // Preferences (consolidated)
    PREFERENCES_NOTIFICATIONS: "preferences-notifications",
    PREFERENCES_KEYBOARD: "preferences-keyboard",
    PREFERENCES_CONFIRM_QUIT: "preferences-confirm-quit",
    PREFERENCES_BRANCH_PREFIX: "preferences-branch-prefix",
    PREFERENCES_LINK_BEHAVIOR: "preferences-link-behavior",

    // Presets
    PRESETS_MANAGEMENT: "presets-management",
    PRESETS_TEMPLATES: "presets-templates",
    PRESETS_AUTO_APPLY: "presets-auto-apply",

    // Sessions
    SESSIONS_ACTIVE: "sessions-active",

    // Repository (was project)
    REPOSITORY_NAME: "repository-name",
    REPOSITORY_PATH: "repository-path",
    REPOSITORY_SCRIPTS: "repository-scripts",
    REPOSITORY_BRANCH_PREFIX: "repository-branch-prefix",

    // Node (was workspace)
    NODE_NAME: "node-name",
    NODE_BRANCH: "node-branch",
    NODE_PATH: "node-path",
} as const;
```

**Step 2: Update SETTINGS_ITEMS with new sections and descriptions**

---

## Task 14: Update Shared Types

**Files:**
- Modify: `src/shared/types/workspace.ts` → `src/shared/types/node.ts`
- Modify: `src/shared/types/workspace-init.ts` → `src/shared/types/node-init.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/tabs-types.ts`
- Modify: `src/shared/notification-types.ts`

**Step 1: Rename type files and update interfaces**

```typescript
// node.ts (was workspace.ts)
export interface Node {
    id: string;
    name: string;
    repoPath: string;
    branch: string;
    worktrees: Worktree[];
    createdAt: string;
    updatedAt: string;
}
```

---

## Task 15: Update UI Copy to Professional Tone

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/appearance/components/AppearanceSettings/AppearanceSettings.tsx`
- Modify: All settings component files

**Step 1: Update page headers and descriptions**

Apply copy from design document:
- "Configure visual preferences for the Caspian interface"
- "Configure application behavior and interaction settings"
- "Manage execution configurations for AI coding agents"
- "Monitor and control active agent sessions"

**Step 2: Update individual setting labels**

Apply professional descriptions for all settings.

---

## Task 16: Update NewWorkspaceModal → NewNodeModal

**Files:**
- Rename: `src/renderer/components/NewWorkspaceModal/` → `NewNodeModal/`
- Update all internal references

**Step 1: Rename and update component**

- Rename directory and file
- Update component name
- Update all labels and copy to use "Node" terminology

---

## Task 17: Fix All Import Paths

**Files:**
- All files that import renamed modules

**Step 1: Search and replace imports**

Use IDE/editor to find and replace all broken imports after renames.

Run: `npx tsc --noEmit` to find remaining issues.

---

## Task 18: Update Main Window Runtime Registry

**Files:**
- Modify: `src/main/lib/workspace-runtime/` → `node-runtime/`
- Update all references

**Step 1: Rename and update**

- Rename directory
- Update function names: `getWorkspaceRuntimeRegistry` → `getNodeRuntimeRegistry`
- Update all usages

---

## Task 19: Test and Verify

**Step 1: Run TypeScript compilation**

```bash
npx tsc --noEmit
```

**Step 2: Run the app in dev mode**

```bash
npm run dev
```

**Step 3: Manual testing checklist**

- [ ] Settings sidebar shows 4 categories
- [ ] Appearance settings work
- [ ] Preferences page shows all merged settings
- [ ] Presets page shows preset management
- [ ] Sessions page shows active sessions
- [ ] Repository settings accessible and functional
- [ ] Node settings accessible and functional
- [ ] Search works across all settings
- [ ] Create new node works
- [ ] Delete node works
- [ ] All tRPC calls succeed

---

## Task 20: Commit Changes

**Step 1: Stage and commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: rebrand workspace→node, project→repository across codebase

- Rename database tables and types
- Rename tRPC routers and procedures
- Rename Zustand stores
- Rename React components and routes
- Consolidate settings: 5 categories → 4 (Appearance, Preferences, Presets, Sessions)
- Update all UI copy to professional tone
- Update settings search system

BREAKING: Database schema renamed, requires fresh database

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```
