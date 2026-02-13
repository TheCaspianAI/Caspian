# Antimetal-Inspired Dark + Cream Theme

## Goal

Replace Caspian's warm-metallic (brown/amber) theme with an Antimetal-inspired palette: deep near-neutral darks, warm cream/champagne text, subtle ivory accent. Warmth lives in foreground elements, not surfaces.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Background tone | Near-neutral deep dark, barely perceptible warm hint | Current amber backgrounds look too brown/chocolate |
| Text color | Warm cream/champagne | The "glowy yellow-ish" feel comes from text, not surfaces |
| Primary accent | Cream/ivory (low chroma) | Understated, cohesive with text palette |
| Interactive style | Ghost/outline (cream border+text on dark) | Only primary CTA gets solid fill |
| Surface hierarchy | Tight luminosity spread | Matches Antimetal's subtle card elevation |
| Glass effects | Removed -- solid opaque surfaces | Clean solid cards with borders for separation |
| Approach | Modify existing theme in place + audit components | CSS tokens + caspian.ts + hardcoded color fixes |

## Color Tokens

### Backgrounds (OKLCH)

Near-neutral deep darks. Hue ~70, chroma ~0.004 (5x less than current 0.02).

| Token | Value | Purpose |
|-------|-------|---------|
| `background` | `oklch(0.13 0.004 70)` | Deepest canvas |
| `card` | `oklch(0.15 0.004 70)` | Panels/cards |
| `popover` | `oklch(0.17 0.005 70)` | Dropdowns/overlays |
| `input` | `oklch(0.11 0.003 70)` | Input wells |
| `secondary` | `oklch(0.16 0.004 70)` | Secondary surfaces |
| `tertiary` | `oklch(0.14 0.004 70)` | Toolbar inactive |
| `tertiary-active` | `oklch(0.16 0.004 70)` | Toolbar active |

Luminosity spread: 0.11 - 0.17 (tight, ~0.06 range).

### Foreground/Text (OKLCH)

Warm cream -- higher chroma than current for visible warmth against neutral darks.

| Token | Value | Purpose |
|-------|-------|---------|
| `foreground` | `oklch(0.90 0.025 80)` | Primary text -- warm cream |
| `nav-foreground` | `oklch(0.68 0.015 75)` | Nav items -- muted warm |
| `muted-foreground` | `oklch(0.55 0.01 70)` | Secondary text -- warm gray |

### Primary Accent (OKLCH)

Bright cream/ivory replacing gold. Ghost style for most interactions.

| Token | Value | Purpose |
|-------|-------|---------|
| `primary` | `oklch(0.88 0.035 80)` | Bright cream/ivory |
| `primary-foreground` | `oklch(0.13 0.004 70)` | Dark text on cream fills |

### Accent/Hover

| Token | Value | Purpose |
|-------|-------|---------|
| `accent` | `oklch(0.18 0.006 72)` | Hover background -- barely lighter |
| `accent-foreground` | `oklch(0.88 0.025 78)` | Hover text -- cream |

### Borders

| Token | Value | Purpose |
|-------|-------|---------|
| `border` | `oklch(1 0 0 / 0.10)` | Subtle white at 10% opacity |
| `ring` | `oklch(0.88 0.035 80)` | Focus ring matches primary cream |

### Sidebar (mirrors main)

| Token | Value |
|-------|-------|
| `sidebar` | `oklch(0.13 0.004 70)` |
| `sidebar-primary` | `oklch(0.88 0.035 80)` |
| `sidebar-accent` | `oklch(0.18 0.006 72)` |
| `sidebar-accent-foreground` | `oklch(0.88 0.025 78)` |

## Surface Model

All surfaces are solid and opaque. No glassmorphism.

| Class | Background | Border | Backdrop |
|-------|-----------|--------|----------|
| `.surface-recessed` | `var(--input)` | `var(--border)` | none |
| `.surface-flush` | `var(--card)` | `var(--border)` | none |
| `.surface-raised` | `var(--popover)` | `var(--border)` | **none** (was blur 24px) |

Shadows remain for elevation cues at existing scale.

## Component Audit

Files with hardcoded warm colors to update:

1. `src/renderer/globals.css` -- all `:root` variables, `@theme` block, surface utilities
2. `src/shared/themes/built-in/caspian.ts` -- TypeScript theme definition
3. `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/TabView/mosaic-theme.css`
4. `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/GroupStrip/GroupItem.tsx`
5. `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/GroupStrip/GroupStrip.tsx`
6. `src/renderer/routes/_authenticated/_dashboard/components/TopBar/TopBar.tsx`
7. `src/renderer/routes/_authenticated/_dashboard/layout.tsx`
8. `src/renderer/screens/main/components/NodeSidebar/` (NodeSidebar.tsx, NodesPanel.tsx, RepositorySection.tsx, SidebarNodeRow.tsx)
9. `src/renderer/screens/main/components/NodeView/ContentView/TabsContent/EmptyTabView.tsx`
10. `src/ui/components/ui/` (command.tsx, context-menu.tsx, dropdown-menu.tsx, select.tsx, tabs.tsx, tooltip.tsx, kbd.tsx)
