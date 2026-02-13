# Antimetal-Inspired Dark + Cream Theme — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Caspian's warm-metallic (brown/amber) theme with deep near-neutral darks, warm cream text, and subtle ivory accent — inspired by Antimetal's visual identity.

**Architecture:** Three files need real changes: `globals.css` (CSS tokens + surface model), `caspian.ts` (TypeScript theme definition), and `tooltip.tsx` (remove glass opacity). All other components auto-inherit through CSS variables and Tailwind theme tokens.

**Tech Stack:** TailwindCSS v4 (inline `@theme`), OKLCH color space, CSS custom properties, Zustand theme store

**Design doc:** `docs/plans/2026-02-13-antimetal-dark-cream-theme-design.md`

---

### Task 1: Update CSS token values in globals.css

**Files:**
- Modify: `src/renderer/globals.css:36-103` (`:root` block)

**Step 1: Replace all `:root` color variables**

Replace the entire `:root` color block (lines 44-81) with the new Antimetal-inspired values. Keep status colors, radius, and typography unchanged.

```css
/*
 * Caspian default theme — Antimetal-inspired deep dark with cream accent.
 * Near-neutral backgrounds (hue ~70, chroma ~0.004).
 * Warm cream foreground/accent (hue ~80, chroma 0.025-0.035).
 * The theme store overrides these via inline styles when themes change.
 */
--background: oklch(0.13 0.004 70);
--foreground: oklch(0.90 0.025 80);
--nav-foreground: oklch(0.68 0.015 75);
--card: oklch(0.15 0.004 70);
--card-foreground: oklch(0.90 0.025 80);
--popover: oklch(0.17 0.005 70);
--popover-foreground: oklch(0.90 0.025 80);
--primary: oklch(0.88 0.035 80);
--primary-foreground: oklch(0.13 0.004 70);
--secondary: oklch(0.16 0.004 70);
--secondary-foreground: oklch(0.90 0.025 80);
--muted: oklch(0.15 0.004 70);
--muted-foreground: oklch(0.55 0.01 70);
--accent: oklch(0.18 0.006 72);
--accent-foreground: oklch(0.88 0.025 78);
--tertiary: oklch(0.14 0.004 70);
--tertiary-active: oklch(0.16 0.004 70);
--destructive: oklch(0.63 0.2 25);
--destructive-foreground: oklch(0.63 0.2 25);
--border: oklch(1 0 0 / 0.10);
--input: oklch(0.11 0.003 70);
--ring: oklch(0.88 0.035 80);

/* Sidebar — matches background for seamless look */
--sidebar: oklch(0.13 0.004 70);
--sidebar-foreground: oklch(0.90 0.025 80);
--sidebar-primary: oklch(0.88 0.035 80);
--sidebar-primary-foreground: oklch(0.13 0.004 70);
--sidebar-accent: oklch(0.18 0.006 72);
--sidebar-accent-foreground: oklch(0.88 0.025 78);
--sidebar-border: oklch(1 0 0 / 0.10);
--sidebar-ring: oklch(0.88 0.035 80);

/* Charts — neutral with subtle warm shift */
--chart-1: oklch(0.50 0.008 72);
--chart-2: oklch(0.60 0.010 74);
--chart-3: oklch(0.70 0.012 76);
--chart-4: oklch(0.40 0.006 70);
--chart-5: oklch(0.55 0.009 73);
```

**Step 2: Update the design system comment at top of file**

Replace the comment block at lines 7-17:

```css
/**
 * Design System — Antimetal
 *
 * Deep neutral dark theme with warm cream text and ivory accent.
 * Inspired by Antimetal's premium dark aesthetic.
 * Warmth lives in foreground elements, not surfaces.
 *
 * IMPORTANT: All shadcn variables (--background, --foreground, etc.) use DIRECT values,
 * not var() references. The theme store (applyUIColors) overrides these via inline styles
 * when a theme is applied. Using var() references would create a two-layer token system
 * that breaks theme switching.
 */
```

**Step 3: Verify**

Run: `bun run typecheck`
Expected: PASS (CSS-only changes, no type impact)

**Step 4: Commit**

```bash
git add src/renderer/globals.css
git commit -m "feat(theme): antimetal-inspired token values — neutral darks, cream accent"
```

---

### Task 2: Remove glassmorphism from globals.css

**Files:**
- Modify: `src/renderer/globals.css:277-323` (glass treatment + surface-raised)

**Step 1: Remove the glass treatment block**

Delete the entire glass treatment block (lines 277-291) that applies `backdrop-filter: blur(24px)` to overlay selectors:

```css
/* DELETE this entire block */
[data-radix-popper-content-wrapper] > *,
[data-slot="popover"],
[data-slot="dialog-content"],
[role="dialog"],
[data-sonner-toast],
[data-slot="tooltip-content"] {
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
}
```

**Step 2: Update `.surface-raised` to solid**

Replace the `.surface-raised` utility (lines 315-323) with:

```css
.surface-raised {
    background: var(--popover);
    border: 1px solid var(--border);
    box-shadow:
        0 8px 32px oklch(0 0 0 / 0.3),
        0 2px 8px oklch(0 0 0 / 0.2);
}
```

**Step 3: Update surface model comment**

Replace the comment above the surface utilities (lines 294-304) with:

```css
/*
 * Surface model — semantic background layers.
 * - recessed: darker than background (content wells, inputs)
 * - flush: card-level (panels, toolbars)
 * - raised: elevated overlays with shadow (dropdowns, popovers)
 *
 * All surfaces are solid and opaque. Borders and shadows
 * provide depth cues instead of backdrop blur.
 */
```

**Step 4: Update scrollbar colors to neutral**

Replace the scrollbar thumb colors (lines 241, 251, 255):

- `#3a3837` → `#2a2a2a` (neutral dark gray)
- `#4a4847` → `#3a3a3a` (neutral medium gray)

**Step 5: Update body background gradient to neutral**

Replace the body gradient (lines 182-184):

```css
background-image:
    radial-gradient(ellipse 80% 50% at 50% 20%, oklch(1 0 0 / 0.015) 0%, transparent 70%),
    radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, oklch(0 0 0 / 0.15) 100%);
```

Very subtle — just slightly reduced the top highlight from 0.02 to 0.015.

**Step 6: Commit**

```bash
git add src/renderer/globals.css
git commit -m "feat(theme): remove glassmorphism, solid surfaces with shadow depth"
```

---

### Task 3: Update tooltip.tsx to remove glass opacity

**Files:**
- Modify: `src/ui/components/ui/tooltip.tsx:60,75`

**Step 1: Make tooltip background fully opaque**

In `TooltipContent` (line 60), change:
- `bg-popover/90` → `bg-popover`

In the arrow (line 75), change:
- `bg-popover/90 fill-popover/90` → `bg-popover fill-popover`

**Step 2: Commit**

```bash
git add src/ui/components/ui/tooltip.tsx
git commit -m "fix(tooltip): solid opaque background, no glass transparency"
```

---

### Task 4: Update caspian.ts theme definition

**Files:**
- Modify: `src/shared/themes/built-in/caspian.ts:1-102`

**Step 1: Replace the entire theme definition**

```typescript
import type { Theme } from "../types";

/**
 * Caspian theme — Antimetal-inspired
 *
 * Deep near-neutral dark palette with warm cream text and ivory accent.
 * Backgrounds have barely perceptible warm hint (oklch hue ~70, chroma ~0.004).
 * Foreground and accent use warm cream (oklch hue ~80, chroma 0.025-0.035).
 * Inspired by Antimetal's premium dark aesthetic.
 */
export const caspianTheme: Theme = {
    id: "caspian",
    name: "Caspian",
    author: "Caspian",
    type: "dark",
    isBuiltIn: true,
    description: "Antimetal-inspired — deep neutral dark with warm cream accent",

    ui: {
        // Core backgrounds — near-neutral deep darks
        // Tight spread: 0.11 (input) → 0.13 (base) → 0.15 (card) → 0.17 (overlay)
        background: "oklch(0.13 0.004 70)",
        foreground: "oklch(0.90 0.025 80)",
        navForeground: "oklch(0.68 0.015 75)",

        card: "oklch(0.15 0.004 70)",
        cardForeground: "oklch(0.90 0.025 80)",

        popover: "oklch(0.17 0.005 70)",
        popoverForeground: "oklch(0.90 0.025 80)",

        // Primary — cream/ivory accent
        primary: "oklch(0.88 0.035 80)",
        primaryForeground: "oklch(0.13 0.004 70)",

        secondary: "oklch(0.16 0.004 70)",
        secondaryForeground: "oklch(0.90 0.025 80)",

        muted: "oklch(0.15 0.004 70)",
        mutedForeground: "oklch(0.55 0.01 70)",

        // Accent — hover surface
        accent: "oklch(0.18 0.006 72)",
        accentForeground: "oklch(0.88 0.025 78)",

        tertiary: "oklch(0.14 0.004 70)",
        tertiaryActive: "oklch(0.16 0.004 70)",

        // Destructive — unchanged
        destructive: "#c04040",
        destructiveForeground: "#c04040",

        // Borders — subtle white at 10%
        border: "oklch(1 0 0 / 0.10)",
        input: "oklch(0.11 0.003 70)",
        ring: "oklch(0.88 0.035 80)",

        // Sidebar — matches background
        sidebar: "oklch(0.13 0.004 70)",
        sidebarForeground: "oklch(0.90 0.025 80)",
        sidebarPrimary: "oklch(0.88 0.035 80)",
        sidebarPrimaryForeground: "oklch(0.13 0.004 70)",
        sidebarAccent: "oklch(0.18 0.006 72)",
        sidebarAccentForeground: "oklch(0.88 0.025 78)",
        sidebarBorder: "oklch(1 0 0 / 0.10)",
        sidebarRing: "oklch(0.88 0.035 80)",

        // Charts — neutral with subtle warm shift
        chart1: "oklch(0.50 0.008 72)",
        chart2: "oklch(0.60 0.010 74)",
        chart3: "oklch(0.70 0.012 76)",
        chart4: "oklch(0.40 0.006 70)",
        chart5: "oklch(0.55 0.009 73)",
    },

    terminal: {
        background: "transparent",
        foreground: "#cccccc",
        cursor: "#d4d4d4",
        cursorAccent: "#141414",
        selectionBackground: "#363636",

        // Desaturated ANSI colors
        black: "#2a2a2a",
        red: "#c04040",
        green: "#50a050",
        yellow: "#b0a040",
        blue: "#4070b0",
        magenta: "#806090",
        cyan: "#408090",
        white: "#c8c8c8",

        brightBlack: "#606060",
        brightRed: "#d06060",
        brightGreen: "#80c080",
        brightYellow: "#d0c870",
        brightBlue: "#7090c0",
        brightMagenta: "#a080a0",
        brightCyan: "#60b0c0",
        brightWhite: "#e8e8e8",
    },
};
```

Terminal changes: `cursorAccent` and `selectionBackground` shifted slightly to match new neutral background tone.

**Step 2: Verify types**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/shared/themes/built-in/caspian.ts
git commit -m "feat(theme): update caspian.ts to antimetal-inspired palette"
```

---

### Task 5: Visual verification and final commit

**Step 1: Run lint**

Run: `bun run lint`
Expected: PASS (or only pre-existing issues)

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Start dev and visually verify**

Run: `bun dev`

Visual checklist:
- [ ] Background is deep near-black, not brown/chocolate
- [ ] Text is warm cream, not pure white
- [ ] Sidebar blends seamlessly with background
- [ ] Dropdowns/popovers are solid (no blur/transparency)
- [ ] Active tab indicator uses cream, not gold
- [ ] Focus rings are cream/ivory
- [ ] Scrollbar thumbs are neutral gray
- [ ] Terminal renders correctly on transparent background
- [ ] Hover states show subtle surface change
- [ ] Borders are visible but subtle (10% white)

**Step 4: Fix any visual issues found**

If any component has hardcoded warm colors that clash with the new neutral backgrounds, fix them.

**Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(theme): visual polish after antimetal theme audit"
```

---

## Notes

### Files that auto-inherit (no changes needed)

These files use CSS variables / Tailwind theme tokens and will automatically pick up the new palette:

- `GroupItem.tsx` — uses `text-foreground`, `text-muted-foreground`, `bg-primary/6`, `bg-accent/30`
- `GroupStrip.tsx` — uses theme tokens; `text-yellow-500` on star icon is semantic, not theme
- `TopBar.tsx` — uses `surface-topbar`, `border-border/20`
- `layout.tsx` — uses `bg-background`, `border-border/40`
- `NodeSidebar.tsx` — uses `surface-sidebar`, `surface-topbar`, theme tokens
- `NodesPanel.tsx` — `#6b7280` is a neutral gray fallback for uncolored repos, fine as-is
- `RepositorySection.tsx` — `bg-red-500` for unread indicators is semantic
- `SidebarNodeRow.tsx` — `bg-red-400/500` for unread is semantic
- `EmptyTabView.tsx` — uses `bg-accent/30`, `text-muted-foreground/40`
- `command.tsx` — all theme tokens
- `context-menu.tsx` — all theme tokens
- `dropdown-menu.tsx` — uses `surface-raised` (auto-updates)
- `select.tsx` — uses `surface-raised` (auto-updates)
- `tabs.tsx` — uses `bg-accent/30` (auto-updates)
- `kbd.tsx` — uses `bg-accent/40` (auto-updates)
- `mosaic-theme.css` — uses CSS variables; hardcoded oklch values are neutral
