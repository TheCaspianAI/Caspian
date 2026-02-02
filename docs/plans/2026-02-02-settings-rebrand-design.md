# Settings Rebrand Design

**Date:** 2026-02-02
**Status:** Approved
**Identity:** Control Panel for AI coding agents

## Overview

Rebrand the settings interface to establish Caspian as a distinct product. This includes terminology changes throughout the entire codebase, consolidation of settings categories, and updated professional copy.

## Terminology Changes

### Core Renaming (Codebase-wide)

| Current | New | Scope |
|---------|-----|-------|
| Workspace | Node | Database, types, routes, components, variables |
| Project | Repository | Database, types, routes, components, variables |

### Affected Layers

| Layer | Current | New |
|-------|---------|-----|
| Database/Schema | `workspaces` table, `projects` table | `nodes` table, `repositories` table |
| tRPC Routers | `workspaces.*`, `projects.*` | `nodes.*`, `repositories.*` |
| Types/Interfaces | `Workspace`, `Project`, `WorkspaceId` | `Node`, `Repository`, `NodeId` |
| Stores | `useWorkspaceStore`, project stores | `useNodeStore`, repository stores |
| Routes | `/workspace/`, `/project/` | `/node/`, `/repository/` |
| Components | `WorkspaceSidebar`, `ProjectSettings` | `NodeSidebar`, `RepositorySettings` |
| Variables | `workspaceId`, `projectPath` | `nodeId`, `repositoryPath` |

### Unchanged Terms

- Agent names in templates (Claude, Codex, Gemini, Cursor)
- External library/dependency names
- Git-related terms (branch, commit, etc.)
- "Presets" terminology

## Settings Structure

### Consolidated Categories (5 → 4)

```
Settings
├── General
│   ├── Appearance      (paintbrush icon)
│   ├── Preferences     (sliders icon)
│   ├── Presets         (command-line icon)
│   └── Sessions        (activity icon)
│
└── Repositories
    ├── my-app/
    │   ├── Node: feature-auth
    │   └── Node: bugfix-login
    └── api-server/
        └── Node: main
```

### Category Contents

| Category | Settings Included |
|----------|-------------------|
| **Appearance** | Theme selection, Markdown rendering style, Custom themes (coming soon) |
| **Preferences** | Notification sounds, Confirm before quitting, Branch prefix, Keyboard shortcuts, Link behavior |
| **Presets** | Preset management table, Quick-add agent templates, Auto-apply default preset toggle |
| **Sessions** | Active sessions table, Kill session actions, Clear history, Restart daemon |

### Removed/Merged Sections

- **Notifications** → merged into Preferences
- **Keyboard** → merged into Preferences
- **Features (Behavior)** → merged into Preferences
- **Terminal** → split into Presets + Sessions

## Page Copy (Professional/Enterprise Tone)

### Page Headers

| Page | Header | Subtitle |
|------|--------|----------|
| Appearance | Appearance | Configure visual preferences for the Caspian interface |
| Preferences | Preferences | Configure application behavior and interaction settings |
| Presets | Presets | Manage execution configurations for AI coding agents |
| Sessions | Sessions | Monitor and control active agent sessions |
| Repository | [Repository Name] | Repository configuration and node management |
| Node | [Node Name] | Node configuration and working environment |

### Setting Labels & Descriptions

| Setting | Label | Description |
|---------|-------|-------------|
| Theme | Interface Theme | — |
| Markdown | Markdown Rendering | — |
| Notifications toggle | Notification Sounds | Enable audio notifications for completed operations |
| Quit confirm | Confirm Before Quitting | Require confirmation before closing the application |
| Branch prefix | Branch Prefix | Configure branch naming conventions for new nodes |
| Quick-add | Agent Templates | — |
| Auto-apply preset | Auto-apply Default Preset | Automatically apply default preset when creating nodes |

## Repository Settings Page

| Field | Label | Description |
|-------|-------|-------------|
| Name | Repository Name | Display name for this repository |
| Path | Repository Path | Local filesystem path (clickable with "Open In" menu) |
| Branch Prefix | Branch Prefix | Override branch naming convention for this repository |
| Scripts | Setup & Teardown Scripts | Shell scripts executed when nodes are created or removed |

## Node Settings Page

| Field | Label | Description |
|-------|-------|-------------|
| Name | Node Name | Identifier for this node (editable) |
| Branch | Active Branch | Current git branch with rebase status indicator |
| Path | Working Directory | Node's working directory path |

## URL Route Changes

| Current | New |
|---------|-----|
| `/settings/workspace/$workspaceId/` | `/settings/node/$nodeId/` |
| `/settings/project/$projectId/` | `/settings/repository/$repositoryId/` |
| `/settings/terminal/` | `/settings/presets/` |
| `/settings/ringtones/` | (merged into `/settings/preferences/`) |
| `/settings/keyboard/` | (merged into `/settings/preferences/`) |
| `/settings/behavior/` | (merged into `/settings/preferences/`) |

## Implementation Phases

### Phase 1: Database & Types
- Rename database tables: `workspaces` → `nodes`, `projects` → `repositories`
- Update Drizzle schema definitions
- Update all TypeScript types and interfaces
- Create migration if needed

### Phase 2: tRPC Layer
- Rename routers: `workspaces` → `nodes`, `projects` → `repositories`
- Update all procedure names and inputs/outputs
- Update router exports and registration

### Phase 3: Stores & State
- Rename Zustand stores
- Update all selectors and actions
- Update store references throughout components

### Phase 4: Routes & Components
- Rename route files and directories
- Update route parameters
- Rename component files and directories
- Update component names and imports

### Phase 5: Settings Consolidation
- Create new Preferences page combining keyboard, notifications, behavior
- Create new Sessions page extracted from terminal
- Rename Terminal page to Presets
- Update sidebar navigation
- Update settings search system

### Phase 6: Copy & Polish
- Update all UI text with professional copy
- Update descriptions and labels
- Test all settings flows
