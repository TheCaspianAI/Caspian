# Metallic Instrument Panel — Theme Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the default Caspian theme's clinical monochromatic palette with a warm, premium dark aesthetic featuring a gold/champagne accent color, inspired by Antimetal's visual design.

**Architecture:** The Caspian app uses a theme system where color tokens are defined as TypeScript objects in `src/shared/themes/built-in/`, applied to CSS variables at runtime via `applyUIColors()`, and consumed by Tailwind utility classes throughout the renderer. This plan updates the default "Caspian" theme definition, the fallback CSS variable defaults, and a small number of hardcoded color values in component styles. No structural changes to the theme system itself.

**Tech Stack:** Electron + React, TailwindCSS v4 + shadcn/ui, Zustand (theme store)

---

This ImplPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: This plan follows conventions from AGENTS.md and this template.

## Purpose / Big Picture

After this change, a user opening Caspian will see a warmer, more premium dark interface. Primary action buttons (create node, confirm dialogs) will be gold/champagne instead of white. Active sidebar indicators will glow gold. Focus rings will have a warm golden tint. The background surfaces will carry a barely perceptible warm undertone instead of the current clinical grey. The overall impression shifts from "monochrome tool" to "brass hardware on matte black" — a luxury instrument panel.

To verify: launch the app with `bun dev`. The sidebar's active node indicator should be gold. The primary buttons in any dialog should have a gold fill with dark text. Focus-tabbing through elements should show warm gold focus rings. The background should feel subtly warmer than pure grey, though the shift is intentionally understated.

## Assumptions

1. The theme system's `applyUIColors()` function accepts any valid CSS color string, not just hex. This means we can use `oklch()` values directly in the theme definition for better precision on the subtle chroma shifts. (To be confirmed in Milestone 1.)

2. Changing `--primary` to gold will not break any component where white/neutral primary is semantically required, because the only components using `bg-primary` are buttons, checkboxes, switches, and active indicators — all of which should adopt the gold accent.

3. Other built-in themes (Nord, GitHub Dark, GitHub Light, Rose Pine, Everforest) are not affected — they have their own complete token sets.

## Open Questions

None — all questions resolved during design phase.

## Progress

- [ ] Milestone 1: Theme token overhaul (caspian.ts + globals.css defaults)
- [ ] Milestone 2: Hardcoded color refinements (scrollbars, active indicator, surface utilities, background depth)
- [ ] Milestone 3: Validation (typecheck, lint, tests, visual check)

## Surprises & Discoveries

(To be filled during implementation.)

## Decision Log

- Decision: Use oklch color strings in the theme TypeScript file instead of hex.
  Rationale: The design spec uses oklch values with very low chroma (0.005–0.015). Converting these to hex loses the precision of the warm shift. The `applyUIColors()` function calls `root.style.setProperty(cssVar, value)` which accepts any valid CSS color string. oklch is supported in all Chromium-based browsers (which Electron uses).
  Date: 2026-02-13 / Design phase

- Decision: Change `--primary` token from near-white to gold/champagne globally.
  Rationale: In the current theme, `--primary` is `#d4d4d4` (near-white) and is used for: default button fills, checked checkboxes/switches, and active sidebar indicators. Changing this single token to gold cascades the accent color to all primary interactive elements without touching individual component files. This is the highest-leverage change in the redesign.
  Date: 2026-02-13 / Design phase

- Decision: Keep terminal ANSI colors unchanged.
  Rationale: Terminal output should remain neutral/desaturated for readability. The gold accent is for app chrome, not content.
  Date: 2026-02-13 / Design phase

## Outcomes & Retrospective

(To be filled at completion.)

## Context and Orientation

This plan affects the **renderer process** (browser-only React UI) and **shared code** (theme definitions). No main process or tRPC changes are needed.

### How the theme system works

The app supports multiple color themes. Each theme is a TypeScript object conforming to the `Theme` interface defined in `src/shared/themes/types.ts`. The object has two sections: `ui` (app chrome colors) and `terminal` (xterm.js ANSI palette).

Built-in themes live in `src/shared/themes/built-in/`. The default theme is "caspian" defined in `src/shared/themes/built-in/caspian.ts`.

When the app starts, the Zustand theme store (`src/renderer/stores/theme/store.ts`) calls `applyUIColors(theme.ui)`, which iterates over every key in the theme's `ui` object and calls `document.documentElement.style.setProperty(cssVarName, colorValue)`. This overrides the CSS variable defaults defined in `src/renderer/globals.css`.

The CSS variables are consumed by Tailwind utility classes. For example, `bg-primary` resolves to `var(--primary)`, which is whatever the active theme set it to.

### Key files

- `src/shared/themes/built-in/caspian.ts` — The default theme definition (UI + terminal colors). **Primary edit target.**
- `src/renderer/globals.css` — CSS variable fallback defaults, font faces, scrollbar styles, surface utilities, active indicator. **Secondary edit target.**
- `src/ui/globals.css` — shadcn's CSS variable definitions (light + dark). These are the fallbacks used by the `src/ui/` component library when previewed in isolation. **Minor edit target.**
- `src/renderer/stores/theme/utils/css-variables.ts` — The `applyUIColors()` function that maps theme keys to CSS vars. **Read-only reference** (no changes needed).
- `src/ui/components/ui/button.tsx` — Button component using `bg-primary text-primary-foreground`. **No changes needed** (token swap handles it).
- `src/ui/components/ui/badge.tsx` — Badge using `bg-accent text-muted-foreground`. **No changes needed.**
- `src/ui/components/ui/card.tsx` — Card using `bg-card border-border`. **No changes needed.**

### What changes and what does not

**Changes:**
- All `ui` color values in `caspian.ts` (backgrounds get warm hue, primary becomes gold, text gets warm whites)
- CSS variable defaults in `src/renderer/globals.css` `:root` block
- Hardcoded scrollbar colors in `src/renderer/globals.css`
- Active indicator pseudo-element color in `src/renderer/globals.css`
- Dark theme fallback values in `src/ui/globals.css` `.dark` block
- Design system comment block at top of `src/renderer/globals.css`

**Does not change:**
- No component files (button, card, badge, etc.) — token changes cascade automatically
- No terminal colors
- No other themes (Nord, GitHub Dark, etc.)
- No layout, typography, border radii, or animation timing
- No theme store logic or CSS variable mapping
- No tRPC procedures or main process code

---

## Plan of Work

### Milestone 1: Theme Token Overhaul

This milestone replaces all color values in the default Caspian theme and the corresponding CSS variable fallbacks. After this milestone, launching the app will show the new warm palette with gold accents. This is the bulk of the visual change.

#### Task 1: Update `src/shared/themes/built-in/caspian.ts`

Replace the entire `ui` color object with warm-shifted oklch values. The `terminal` section remains unchanged.

Open `src/shared/themes/built-in/caspian.ts`. Replace the file contents with the following. The key changes are annotated inline:

    import type { Theme } from "../types";

    /**
     * Caspian theme — Metallic Instrument Panel
     *
     * Warm premium dark palette with gold/champagne accent.
     * Backgrounds carry a subtle warm undertone (oklch hue ~60, very low chroma).
     * Primary actions use gold (oklch 0.78 0.11 85).
     * Inspired by Antimetal's design language.
     */
    export const caspianTheme: Theme = {
    	id: "caspian",
    	name: "Caspian",
    	author: "Caspian",
    	type: "dark",
    	isBuiltIn: true,
    	description: "Metallic Instrument Panel — warm precision with gold accent",

    	ui: {
    		// Core backgrounds — warm hue shift (hue 60, chroma 0.005)
    		background: "oklch(0.22 0.005 60)",
    		foreground: "oklch(0.88 0.01 80)",
    		navForeground: "oklch(0.73 0.008 75)",

    		card: "oklch(0.24 0.005 60)",
    		cardForeground: "oklch(0.88 0.01 80)",

    		popover: "oklch(0.27 0.006 60)",
    		popoverForeground: "oklch(0.88 0.01 80)",

    		// Primary — gold/champagne accent
    		primary: "oklch(0.78 0.11 85)",
    		primaryForeground: "oklch(0.20 0.01 60)",

    		secondary: "oklch(0.27 0.006 60)",
    		secondaryForeground: "oklch(0.88 0.01 80)",

    		muted: "oklch(0.24 0.005 60)",
    		mutedForeground: "oklch(0.58 0.006 65)",

    		// Accent — warm elevated surface
    		accent: "oklch(0.30 0.015 70)",
    		accentForeground: "oklch(0.85 0.04 80)",

    		tertiary: "oklch(0.24 0.005 60)",
    		tertiaryActive: "oklch(0.27 0.006 60)",

    		// Destructive — unchanged
    		destructive: "#c04040",
    		destructiveForeground: "#c04040",

    		// Borders & inputs — warm shift
    		border: "oklch(0.30 0.008 65)",
    		input: "oklch(0.19 0.004 60)",
    		ring: "oklch(0.78 0.11 85)",

    		// Sidebar — matches main surfaces
    		sidebar: "oklch(0.22 0.005 60)",
    		sidebarForeground: "oklch(0.88 0.01 80)",
    		sidebarPrimary: "oklch(0.78 0.11 85)",
    		sidebarPrimaryForeground: "oklch(0.20 0.01 60)",
    		sidebarAccent: "oklch(0.30 0.015 70)",
    		sidebarAccentForeground: "oklch(0.85 0.04 80)",
    		sidebarBorder: "oklch(0.30 0.008 65)",
    		sidebarRing: "oklch(0.78 0.11 85)",

    		// Charts — warm shifted
    		chart1: "oklch(0.50 0.006 65)",
    		chart2: "oklch(0.60 0.008 70)",
    		chart3: "oklch(0.70 0.010 75)",
    		chart4: "oklch(0.40 0.005 60)",
    		chart5: "oklch(0.55 0.007 68)",
    	},

    	terminal: {
    		background: "transparent",
    		foreground: "#cccccc",
    		cursor: "#d4d4d4",
    		cursorAccent: "#181818",
    		selectionBackground: "#404040",

    		// Desaturated ANSI colors — unchanged
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

Commit after this edit:

    git add src/shared/themes/built-in/caspian.ts
    git commit -m "feat(theme): update Caspian palette to warm metallic with gold accent"

#### Task 2: Update CSS variable defaults in `src/renderer/globals.css`

The `:root` block in this file defines fallback values that apply before the theme store hydrates. They should match the new Caspian theme values so there is no flash of wrong colors during startup.

Open `src/renderer/globals.css`. Update the comment block at the top (lines 7-22) and the `:root` CSS variable declarations (lines 41-120).

Replace the design system comment (lines 7-22) with:

    /**
     * Design System — Metallic Instrument Panel
     *
     * Design principles:
     * - Warm premium dark palette with gold/champagne accent (oklch 0.78 0.11 85)
     * - Backgrounds carry subtle warm undertone (oklch hue ~60, chroma 0.005)
     * - Hierarchy through luminosity and accent placement, not hue variety
     * - Recessed surfaces for content wells, flush for panels, raised for overlays only
     * - Hairline 1px borders everywhere, tighter radii (6px interactive, 10px overlay max)
     * - 13px base font size with Geist + Geist Mono
     * - Speed: 80ms hovers, instant node/tab switching
     *
     * IMPORTANT: All shadcn variables (--background, --foreground, etc.) use DIRECT values,
     * not var() references. The theme store (applyUIColors) overrides these via inline styles
     * when a theme is applied. Using var() references would create a two-layer token system
     * that breaks theme switching.
     */

Replace the tonal range comment and variable block (lines 56-104) with:

    /*
     * Warm metallic tonal range — Antimetal-inspired.
     * Key: surfaces carry subtle warm undertone (hue 60, chroma 0.005).
     * Primary actions use gold/champagne (oklch 0.78 0.11 85).
     * Background spread: 0.19 (recessed) → 0.22 (base) → 0.24 (surface) → 0.27 (elevated)
     * Text: 0.88 warm white primary, 0.73 warm navigation, 0.58 warm secondary
     * Borders: 0.30 with warm tint
     * Sidebar: same as background (seamless)
     */
    --background: oklch(0.22 0.005 60);
    --foreground: oklch(0.88 0.01 80);
    --nav-foreground: oklch(0.73 0.008 75);
    --card: oklch(0.24 0.005 60);
    --card-foreground: oklch(0.88 0.01 80);
    --popover: oklch(0.27 0.006 60);
    --popover-foreground: oklch(0.88 0.01 80);
    --primary: oklch(0.78 0.11 85);
    --primary-foreground: oklch(0.20 0.01 60);
    --secondary: oklch(0.27 0.006 60);
    --secondary-foreground: oklch(0.88 0.01 80);
    --muted: oklch(0.24 0.005 60);
    --muted-foreground: oklch(0.58 0.006 65);
    --accent: oklch(0.30 0.015 70);
    --accent-foreground: oklch(0.85 0.04 80);
    --tertiary: oklch(0.24 0.005 60);
    --tertiary-active: oklch(0.27 0.006 60);
    --destructive: oklch(0.63 0.2 25);
    --destructive-foreground: oklch(0.63 0.2 25);
    --border: oklch(0.30 0.008 65);
    --input: oklch(0.19 0.004 60);
    --ring: oklch(0.78 0.11 85);

    /* Sidebar — same as background for seamless look */
    --sidebar: oklch(0.22 0.005 60);
    --sidebar-foreground: oklch(0.88 0.01 80);
    --sidebar-primary: oklch(0.78 0.11 85);
    --sidebar-primary-foreground: oklch(0.20 0.01 60);
    --sidebar-accent: oklch(0.30 0.015 70);
    --sidebar-accent-foreground: oklch(0.85 0.04 80);
    --sidebar-border: oklch(0.30 0.008 65);
    --sidebar-ring: oklch(0.78 0.11 85);

    /* Charts — warm shifted */
    --chart-1: oklch(0.50 0.006 65);
    --chart-2: oklch(0.60 0.008 70);
    --chart-3: oklch(0.70 0.010 75);
    --chart-4: oklch(0.40 0.005 60);
    --chart-5: oklch(0.55 0.007 68);

Commit after this edit:

    git add src/renderer/globals.css
    git commit -m "feat(theme): update CSS variable defaults to warm metallic palette"

#### Task 3: Update dark theme fallbacks in `src/ui/globals.css`

This file provides fallback values for the shadcn component library. The `.dark` block (lines 79-111) should match the new Caspian defaults so components render correctly if previewed outside the full app.

Open `src/ui/globals.css`. Replace the `.dark` block (lines 79-111) with:

    .dark {
    	--background: oklch(0.22 0.005 60);
    	--foreground: oklch(0.88 0.01 80);
    	--card: oklch(0.24 0.005 60);
    	--card-foreground: oklch(0.88 0.01 80);
    	--popover: oklch(0.27 0.006 60);
    	--popover-foreground: oklch(0.88 0.01 80);
    	--primary: oklch(0.78 0.11 85);
    	--primary-foreground: oklch(0.20 0.01 60);
    	--secondary: oklch(0.27 0.006 60);
    	--secondary-foreground: oklch(0.88 0.01 80);
    	--muted: oklch(0.24 0.005 60);
    	--muted-foreground: oklch(0.58 0.006 65);
    	--accent: oklch(0.30 0.015 70);
    	--accent-foreground: oklch(0.85 0.04 80);
    	--destructive: oklch(0.63 0.2 25);
    	--border: oklch(0.30 0.008 65);
    	--input: oklch(0.19 0.004 60);
    	--ring: oklch(0.78 0.11 85);
    	--chart-1: oklch(0.50 0.006 65);
    	--chart-2: oklch(0.60 0.008 70);
    	--chart-3: oklch(0.70 0.010 75);
    	--chart-4: oklch(0.40 0.005 60);
    	--chart-5: oklch(0.55 0.007 68);
    	--sidebar: oklch(0.22 0.005 60);
    	--sidebar-foreground: oklch(0.88 0.01 80);
    	--sidebar-primary: oklch(0.78 0.11 85);
    	--sidebar-primary-foreground: oklch(0.20 0.01 60);
    	--sidebar-accent: oklch(0.30 0.015 70);
    	--sidebar-accent-foreground: oklch(0.85 0.04 80);
    	--sidebar-border: oklch(0.30 0.008 65);
    	--sidebar-ring: oklch(0.78 0.11 85);
    }

Commit after this edit:

    git add src/ui/globals.css
    git commit -m "feat(theme): update shadcn dark fallbacks to warm metallic palette"

---

### Milestone 2: Hardcoded Color Refinements

Some styles in `globals.css` use hardcoded oklch values that bypass the theme system. These need manual warm-shifting to match the new palette. This milestone also adds a subtle ambient gradient on the body for depth.

#### Task 4: Warm-shift scrollbar colors

In `src/renderer/globals.css`, the scrollbar styles (lines 253-270) use hardcoded `oklch(0.3 0 0)` and `oklch(0.4 0 0)` — pure achromatic grey. Shift these to match the warm palette.

Find and replace these four hardcoded scrollbar colors:

- Line 256: `scrollbar-color: oklch(0.3 0 0) transparent;` → `scrollbar-color: oklch(0.30 0.005 60) transparent;`
- Line 265: `background: oklch(0.3 0 0);` → `background: oklch(0.30 0.005 60);`
- Line 268: `background: oklch(0.4 0 0);` → `background: oklch(0.38 0.006 60);`

#### Task 5: Update active indicator to use primary (gold)

In `src/renderer/globals.css`, the `.active-indicator::before` pseudo-element (line 374) uses `var(--foreground)` for its color. This makes the indicator bar the same color as body text (warm white). For the metallic redesign, this should use the gold accent.

Find line 374:

    background: var(--foreground);

Replace with:

    background: var(--primary);

This makes the active indicator bar gold, matching the sidebar active indicators that already use `bg-primary`.

#### Task 6: Add subtle ambient depth to body

Add a background gradient to the body element to create the "looking into depth" effect described in the design spec. This is a very subtle radial gradient — barely visible, but it prevents the flat digital feel.

In `src/renderer/globals.css`, find the body rule (lines 195-199):

    body {
    	@apply bg-background text-foreground;
    	font-family: "Geist", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    	font-size: 13px;
    }

Replace with:

    body {
    	@apply bg-background text-foreground;
    	font-family: "Geist", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    	font-size: 13px;
    	background-image:
    		radial-gradient(ellipse 80% 50% at 50% 20%, oklch(1 0 0 / 0.02) 0%, transparent 70%),
    		radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, oklch(0 0 0 / 0.15) 100%);
    }

The first gradient is a faint ambient light from above (2% white). The second is a vignette that darkens edges. Together they create cinematic depth.

Commit all Milestone 2 changes:

    git add src/renderer/globals.css
    git commit -m "feat(theme): warm-shift hardcoded colors, gold indicator, ambient depth"

---

### Milestone 3: Validation

Verify the changes compile, pass linting, pass tests, and look correct visually.

#### Task 7: Run typecheck

    bun run typecheck
    # Expected: No type errors. The theme object still conforms to the Theme interface
    # because oklch strings are valid CSS color strings (type: string).

#### Task 8: Run linter

    bun run lint
    # Expected: No new lint errors. If Biome flags any formatting issues in the
    # edited files, run `bun run lint:fix` to auto-fix.

#### Task 9: Run tests

    bun test
    # Expected: Same results as before (389 pass, 2 fail from missing deps, 2 errors).
    # No test regressions because tests don't depend on specific color values.

#### Task 10: Visual verification

    bun dev
    # Launch the Electron app and verify:
    # 1. Background is dark with a barely perceptible warm tint (not clinical grey)
    # 2. Primary buttons (e.g., in create-node dialog) are gold/champagne with dark text
    # 3. Active sidebar node indicator is a gold bar on the left
    # 4. Focus rings (tab through interactive elements) are gold
    # 5. Checked checkboxes and switches are gold
    # 6. Hover states on sidebar items show warm accent backgrounds
    # 7. Borders are warm-tinted, not pure grey
    # 8. Terminal content is unaffected (still neutral ANSI colors)
    # 9. No color flash on startup (CSS defaults match theme values)

---

## Concrete Steps

All commands run from the project root `/Users/adarsh/.superset/worktrees/Caspian/magnosaurus`.

    # After all edits are complete:
    bun run typecheck   # No type errors
    bun run lint        # No lint errors (or run lint:fix)
    bun test            # No regressions
    bun dev             # Visual verification (see Task 10 checklist)

## Validation and Acceptance

Launch the app:

    bun dev
    # Electron app opens. The overall aesthetic should feel warmer and more premium.
    # Gold/champagne accents on primary actions. Warm-tinted surfaces and borders.
    # Terminal content unchanged. No visual glitches or color flashes.

Run validation commands:

    bun run typecheck   # No type errors
    bun run lint        # No lint errors
    bun test            # All existing tests still pass

## Idempotence and Recovery

All changes are to static configuration (color values in theme files and CSS). They can be re-applied any number of times without side effects. If the result is unsatisfactory, reverting the three commits restores the previous monochromatic theme:

    git revert HEAD~3..HEAD

The theme store will re-apply whatever values are in `caspian.ts` on next app launch.

## Artifacts and Notes

### Color palette summary

    Token              Before (achromatic)     After (warm metallic)
    ─────────────────  ──────────────────────  ────────────────────────────
    background         oklch(0.235 0 0)        oklch(0.22 0.005 60)
    primary            oklch(0.87 0 0)         oklch(0.78 0.11 85)  ← GOLD
    ring               oklch(0.41 0 0)         oklch(0.78 0.11 85)  ← GOLD
    accent             oklch(0.275 0 0)        oklch(0.30 0.015 70)
    border             oklch(0.32 0 0)         oklch(0.30 0.008 65)
    foreground         oklch(0.87 0 0)         oklch(0.88 0.01 80)
    muted-foreground   oklch(0.62 0 0)         oklch(0.58 0.006 65)

### Files changed (3 total)

1. `src/shared/themes/built-in/caspian.ts` — Theme definition (all ui color values)
2. `src/renderer/globals.css` — CSS defaults, scrollbars, active indicator, body gradient
3. `src/ui/globals.css` — Dark theme fallback values

## Interfaces and Dependencies

No new dependencies. No interface changes. The `Theme` type in `src/shared/themes/types.ts` is unchanged — `UIColors` uses `string` type for all color fields, which accepts both hex and oklch values.

The `applyUIColors()` function in `src/renderer/stores/theme/utils/css-variables.ts` calls `root.style.setProperty(cssVar, value)` which passes the color string directly to the CSS engine. Chromium (Electron's rendering engine) has full oklch support.
