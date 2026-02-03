# Settings Layout Makeover Design

Convert settings from a two-panel sidebar layout to a Linear-style single-surface modal with section index.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ (backdrop - click to close)                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [🔍 Search...]  Appearance │ Preferences │ ...  [×] │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │                                                     │   │
│   │  Appearance                                         │   │
│   │  ─────────────────────────────────────────────────  │   │
│   │  [ Theme cards ]                                    │   │
│   │  [ Markdown dropdown ]                              │   │
│   │                                                     │   │
│   │  Preferences                                        │   │
│   │  ─────────────────────────────────────────────────  │   │
│   │  ...                                                │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- Modal overlay with semi-transparent backdrop (`bg-black/50`)
- Content panel centered, `max-w-3xl`, max height ~85vh with internal scroll
- Header: search input (left), tabs (center), close button (right)
- Single scrollable content area
- Subtle section dividers (thin line + section title in regular weight)

## Tab Navigation

**Tabs:** Appearance | Preferences | Presets | Sessions | Repositories

**Behavior:**
- Clicking a tab smooth-scrolls to that section
- Active tab highlighted based on scroll position (intersection observer)
- Tabs stay at top of modal, content scrolls beneath

**Styling:**
- Inactive: muted text color
- Active: primary text color + subtle underline or background pill
- Hover: slight highlight

## Search

**Input:** Compact, in header left side. Placeholder: "Search settings..."

**When searching:**
- Sections with no matches hide entirely
- Matching items highlighted (subtle background)
- First match auto-scrolled into view
- Tabs for non-matching sections become dimmed/disabled
- Reuses existing `settings-search.ts` matching logic
- Repository names are searchable

**Clear:** Clear button, or Escape key restores all sections

## Repositories Accordion

```
Repositories
─────────────────────────────────────────────
▶ my-project                          /path/to/repo
▶ another-repo                        /path/to/other

─ ─ ─ (when expanded) ─ ─ ─

▼ my-project                          /path/to/repo
    Repository Name    [my-project        ]
    Repository Path    /path/to/repo  [open]
    Branch Prefix      [feature/         ▼]
    Setup Script       [                   ]
    Teardown Script    [                   ]
```

- Collapsed: repo name + path on single row, chevron indicates state
- Single-expand: clicking row expands that repo, collapses any other
- Expanded: all repository settings inline (name, path, branch prefix, scripts)
- Node settings: NOT in this accordion (accessed via context menu elsewhere)

## Modal & Close Behavior

**Close triggers:**
- Click backdrop (outside panel)
- Click × button in header
- Press Escape key

**Animation:**
- Open: fade in backdrop, slide up panel (~150ms)
- Close: reverse

**Routing:**
- Stays as `/settings` route for deep-linking
- Renders as overlay on top of current view
- Uses portal or TanStack Router modal pattern

## Implementation Plan

### Phase 1: Create Modal Infrastructure
1. Create `SettingsModal` component with backdrop and panel
2. Add portal rendering to overlay on current route
3. Implement close handlers (backdrop click, × button, Escape)
4. Add open/close animations

### Phase 2: Build Single-Surface Layout
1. Create header with search input, tabs, close button
2. Implement tab click → smooth scroll behavior
3. Add intersection observer for scroll → active tab sync
4. Create section container component with subtle dividers

### Phase 3: Migrate Section Content
1. Compose Appearance settings inline
2. Compose Preferences settings inline
3. Compose Presets settings inline
4. Compose Sessions settings inline

### Phase 4: Repositories Accordion
1. Create accordion component with single-expand behavior
2. Fetch repositories list
3. Render collapsed rows with name + path
4. Expand to show inline repository settings

### Phase 5: Search Integration
1. Add search input to header
2. Connect to existing settings-search matching
3. Implement section hide/show based on matches
4. Add match highlighting
5. Auto-scroll to first match
6. Dim non-matching tabs

### Phase 6: Cleanup
1. Remove old `SettingsSidebar/` components
2. Remove per-section routes (appearance/, preferences/, etc.)
3. Simplify `settings-state.ts` store
4. Remove node settings route (now accessed elsewhere)
5. Update any navigation that pointed to old routes

## Files to Modify

**New/Major changes:**
- `settings/layout.tsx` - Convert to modal overlay
- `settings/page.tsx` - New single-surface component

**Remove:**
- `settings/components/SettingsSidebar/` - No longer needed
- `settings/appearance/page.tsx` - Merged into main
- `settings/preferences/page.tsx` - Merged into main
- `settings/presets/page.tsx` - Merged into main
- `settings/sessions/page.tsx` - Merged into main
- `settings/node/$nodeId/page.tsx` - Removed from settings

**Keep & Reuse:**
- Section content components (AppearanceSettings, PreferencesSettings, etc.)
- `settings-search.ts` - Search matching logic
- `settings/repository/$repositoryId/` - Becomes inline accordion content

**Update:**
- `settings-state.ts` - Simplify store
- Any components that navigate to settings
