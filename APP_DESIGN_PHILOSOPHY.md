# Caspian Design Philosophy

> Warmth in the dark. Confidence in restraint.

---

## Core Direction

Caspian is a supervision tool for AI coding agents. Users rotate through workspaces, scan terminal output, check progress, kick off tasks. The interface optimizes for fast scanning and instant switching — not for settling into one workspace.

The design direction is **warm precision**. Deep dark surfaces with intentional warmth — not the cold blue-grey of most developer tools, and not the sterile pure-black of monochromatic themes. Warmth lives in the foreground: cream-toned text, warm accent colors, and surfaces that carry a barely perceptible undertone. The backgrounds stay deep and quiet. The content glows.

Linear remains the benchmark for execution quality. Not for any specific color choice, but for the discipline: consistent spacing, consistent radii, consistent hover models, no lazy shortcuts. One wrong border radius kills perceived quality faster than any missing feature.

The system supports multiple themes (Grace, Hex, Everforest, GitHub Dark/Light, Rose Pine) but all themes share the same structural principles. A theme changes the palette. It does not change the spatial logic, the border model, the typography, or the interaction patterns.

### Tenets

1. **Content is king.** Terminal output and code diffs are the experience. Chrome frames them, never competes.
2. **Density without clutter.** More information in less space, but never crowded. Precision spacing is the difference.
3. **Warm confidence.** Warmth replaces sterility. Accent color marks every active state, but sparingly — a tint, not a shout.
4. **Layered surfaces.** Panels sit on distinct planes. The sidebar is darker than content. Overlays are brighter. Depth is readable at a glance.
5. **Instant response.** Every interaction responds within one frame. No easing that makes the user wait.

---

## Color System

All colors are defined in oklch (lightness, chroma, hue). oklch provides perceptually uniform lightness steps — a 0.05 difference in L looks like the same amount of contrast everywhere in the palette. Hex values are used only for terminal ANSI colors where xterm.js requires them.

### Theme Architecture

The theme store (`applyUIColors`) sets 34 CSS custom properties as inline styles on `:root`. The `globals.css` file defines fallback defaults. Both must use direct values, never `var()` references to other variables — that would create a two-layer token system that breaks theme switching.

Each theme defines:
- **ui**: 34 color tokens for app chrome (backgrounds, text, borders, accent)
- **terminal**: 16 ANSI colors plus cursor/selection for xterm.js

Tailwind classes like `bg-primary`, `text-foreground`, `border-border/40` resolve to the current theme's CSS variables automatically. Component code never hardcodes colors.

### Surface Hierarchy

Every theme defines a clear surface stack. The Grace default theme uses this range:

```text
Surface          oklch L     Role
─────────────────────────────────────────────────────
input            0.11        Recessed wells (terminals, text inputs)
sidebar          0.13        Navigation plane
background       0.13        App background
tertiary         0.14        Toolbar level
card / muted     0.15        Panel level
secondary        0.16        Secondary surfaces
popover          0.17        Overlays, dropdowns
```

The total spread is deliberately tight (0.06 in lightness). Surfaces read as facets of one object, not separate zones. The Hex theme uses a wider spread (0.11 to 0.29) for a more dramatic layered effect — this is a per-theme choice, not a system rule.

The sidebar uses a separate `--sidebar` token. In Grace, sidebar matches background for a seamless look. In Hex, sidebar is darker than background for a distinct two-plane split. Both are valid approaches — the token system supports either.

### Text

Text carries the warmth. Primary text is warm cream, not stark white. Lower contrast equals higher perceived quality. Stark white on near-black reads as cheap. Warm cream on deep dark reads as considered.

```text
Role             Grace value               Usage
─────────────────────────────────────────────────────
Primary          oklch(0.90 0.025 80)      Headlines, active labels, content
Nav              oklch(0.68 0.015 75)      Sidebar labels, inactive nav items
Muted            oklch(0.55 0.01 70)       Descriptions, meta, timestamps
```

The `navForeground` token exists specifically for sidebar/nav scanning text — a distinct luminosity between primary and muted that optimizes for peripheral reading.

### Accent Color

Each theme defines a `--primary` token. Grace uses warm cream/ivory (`oklch(0.88 0.035 80)`). Hex uses dusty rose (`oklch(0.68 0.10 15)`). Every active state in the UI references `--primary` through Tailwind opacity modifiers:

```text
bg-primary/10    Active sidebar tab, dashboard button (when open)
bg-primary/8     Active node row in sidebar
bg-primary/6     Active content tab
```

This means active states automatically adopt the theme's accent color. A theme author only needs to set `--primary` and all active states shift to match. The accent tint is a wash — barely visible, never a solid fill. The eye reads it as "this one is different" without processing a specific color.

The 3px left indicator on the active node row (`bg-primary`) provides a stronger anchor point. The 2px bottom line on the active content tab (`tab-active-indicator`) provides a secondary one. Both use the full primary color, not a tinted opacity.

### Borders

Borders use semi-transparent white (`oklch(1 0 0 / N)`) rather than solid colors. This adapts to any theme's background — lighter backgrounds get lighter borders, darker backgrounds get darker borders. The opacity controls visibility:

```text
Context          Opacity     Usage
─────────────────────────────────────────────────────
Structural       /20         TopBar bottom border, dashboard header
Section          /40         Sidebar section divider, tab container bottom
Default          /100        Input borders, card outlines (var(--border))
```

Grace sets `--border` to `oklch(1 0 0 / 0.10)`. Hex sets it to `oklch(1 0 0 / 0.09)`. The opacity modifiers (`border-border/20`, `border-border/40`) scale from this base, so even the softest borders remain perceptible.

### Functional Colors

Status colors are the only values that stay constant across all themes:

```text
--status-running:  oklch(0.72 0.15 145)   Green — process active
--status-error:    oklch(0.63 0.20 25)    Red — failure
--status-warning:  oklch(0.75 0.15 80)    Amber — caution
--status-info:     oklch(0.70 0.10 230)   Blue — informational
--status-done:     oklch(0.63 0 0)        Grey — completed
```

These appear in status indicators, error messages, git diff markers, and terminal ANSI output. They never appear as backgrounds or borders on interactive elements.

---

## Typography

### Geist

Geist by Vercel. A typeface designed for developer UIs with a monospaced companion (Geist Mono). One family, total consistency between chrome and content.

Variable weight (100-900), tabular figures by default, optimized for small sizes and screen rendering. Neutral precision — no personality, no quirks. The clinical register this direction needs.

### Scale

The scale is defined as CSS custom properties and exposed as Tailwind utility classes:

| Role | Class | Size | Tracking | Line Height | Usage |
|------|-------|------|----------|-------------|-------|
| Caption | `text-caption` | 11px | 0.02em | 1.0 | Badges, counts |
| Label | `text-label` | 12px | 0.01em | 1.4 | Captions, meta, code/paths |
| Body | `text-body` | 13px | 0 | 1.5 | Body, labels, primary content |
| Section | `text-section` | 14px | -0.005em | 1.3 | Section titles |
| Heading | `text-heading` | 20px | -0.01em | 1.2 | Page headings |

### Rules

- 13px is the base, not 16px. This is a dense professional tool.
- Weight drives hierarchy. 600 for headings, 500 for interactive labels, 400 for body. Never above 600.
- Monospace for anything machine-generated. File paths, branch names, commit hashes — all Geist Mono.
- No italic. Use weight or opacity for emphasis.
- Tight line heights for chrome (1.2-1.3), generous for readable content (1.5).
- Always use the semantic utility classes (`text-body`, `text-label`) rather than raw Tailwind size classes (`text-sm`, `text-xs`). The scale is the system.

---

## Surfaces and Depth

Surfaces communicate hierarchy through layering, not decoration.

### Three Levels

1. **Recessed** (`surface-recessed`) — Terminal panes, text inputs. Content sits *in* the interface. Uses `var(--input)` with a 1px border. The darkest surface in the UI.

2. **Flush** (`surface-flush`) — The default plane. Cards, panels. Uses `var(--card)` with a 1px border. Where most UI lives.

3. **Raised** (`surface-raised`) — Temporary overlays only. Popovers, dropdowns, modals. Uses `var(--popover)` with a 1px border and a two-layer shadow (`0 8px 32px`, `0 2px 8px`). Overlays are the brightest surfaces.

The sidebar and topbar have dedicated surface utilities (`surface-sidebar`, `surface-topbar`) that use their respective tokens. These are structural surfaces, not elevation levels.

### Elevation

Three shadow levels for non-surface use:

```text
elevation-1     0 2px 8px, 0 1px 3px        Subtle lift
elevation-2     0 8px 32px, 0 2px 8px       Standard overlay
elevation-3     0 16px 48px, 0 4px 12px     Modal/dialog
```

All shadows use `oklch(0 0 0 / N)` for consistent depth rendering across themes.

### Background Atmosphere

The body element uses two subtle radial gradients layered over the background color: a faint white glow at the top and a dark vignette around the edges. This creates the impression that the interface has ambient lighting rather than a flat fill. The effect is barely perceptible but contributes to the premium feel.

---

## Borders and Radius

### Border Weight

1px. Everywhere. No 2px borders, no thick dividers. One weight.

### Radius Scale

```text
4px     — Small interactive: menu items, inner elements (rounded-[4px])
6px     — Standard interactive: buttons, inputs, tabs (rounded-[6px])
8px     — Containers: cards, tab lists, command palette (rounded-[8px])
12px    — Structural: panels, sidebars (--radius-structural)
14px    — Overlays: modals, dialogs (--radius-modal)
```

The radius is soft but not round. No `rounded-full` except for status dot indicators. The system avoids both sharp corners (feels cheap) and pill shapes (feels playful). The target is the refined softness of a premium instrument panel.

---

## Active States

Active states are the single most important visual signal in the app. The user is constantly switching between nodes, tabs, and views. The active state must be readable instantly without being loud.

### The Pattern

Every active state uses the same model: a subtle tint of the theme's `--primary` color at low opacity, plus a stronger anchor element (indicator line or bottom bar).

```text
Sidebar view tab (active):     bg-primary/10
Dashboard button (active):     bg-primary/10
Node row (active):             bg-primary/8 + 3px left indicator (bg-primary)
Content tab (active):          bg-primary/6 + 2px bottom line (bg-primary)
```

Inactive states use `text-nav-foreground` (dimmer) and hover to `bg-accent` (theme surface color, not primary tint). This creates a clear distinction: hover is a surface shift, active is a color signal.

### Why Not Grey

Grey active states (`bg-accent`) communicate "this is selected" through luminosity alone. Primary-tinted active states communicate it through both luminosity and color. In a dense interface where many elements compete for attention, the color signal is faster to parse. The tint is kept deliberately low (6-10% opacity) so it reads as a subtle warmth, not a highlight.

---

## Motion

### Speed

```text
80ms    — Hover states, color transitions, active states
150ms   — Panel transitions, sidebar collapse
250ms   — Slide-in panels, modal open/close
```

### Rules

- No animation on node switch. Content swaps instantly.
- No animation on tab switch. Instant.
- Hover feedback: 80ms background color shift only. No scale, no translate, no shadow changes.
- No spring physics, no overshoot. Precise, not playful.
- Scroll is native. No smooth-scroll override.
- Use `transition-colors` for color-only transitions, `transition-all` only when animating non-color properties like the tab indicator.

---

## Terminal

Terminals are the primary content. Their presentation is the most important visual element.

### Well Treatment

- Background: `transparent` — inherits from the recessed surface beneath it
- Pane border: via mosaic theme CSS, adapted per theme
- Radius: 6px on mosaic windows, rounded top on toolbar, rounded bottom on body
- Padding: 0px in xterm. Content goes edge-to-edge.

### Terminal Colors

Each theme defines its own ANSI palette. Grace uses desaturated neutrals. Hex uses warm rose-shifted colors. Community themes (Everforest, Rose Pine) bring their own palettes.

Terminal text is slightly dimmer than UI text — `#cccccc` vs the UI's `oklch(0.90)` foreground. This keeps terminal content from competing with chrome labels while remaining fully readable.

### Toolbar

The terminal pane toolbar uses `var(--tertiary)`, which is barely different from the background. Focused pane toolbar uses `var(--tertiary-active)`. The toolbar blends in, never draws attention.

---

## Components

### Buttons

**Primary:** `bg-primary text-primary-foreground`. Warm cream in Grace, dusty rose in Hex. No border. 6px radius. Hover: slight dim.

**Secondary:** `bg-secondary text-secondary-foreground`. 1px border. Hover: lighten background.

**Ghost:** No fill, no border. Hover: `bg-accent` fill.

**Destructive:** Transparent fill, `text-destructive`. Hover: destructive color at 10% opacity fill.

### Inputs

Background: `var(--input)` (recessed). Border: 1px `var(--border)`. Focus: border shifts to `var(--ring)`. Radius: 6px. No focus ring glow — just a border brightness shift.

### Dropdown Menus

Background: `var(--popover)`. Border: 1px. Shadow: `surface-raised` shadow. Outer radius: 8px. Inner item radius: 4px.

### Tooltips

Background: `bg-popover/90`. Text: `text-popover-foreground`. Radius: 8px. Uses the theme's own popover color, slightly transparent.

### Keyboard Shortcuts (Kbd)

Background: `bg-accent/40`. Border: 1px `border-border/20`. Radius: 4px. Creates a subtle keycap appearance that adapts to any theme.

### Modals

Background: `var(--card)`. Border: 1px. Shadow: `elevation-3`. Radius: 14px (`--radius-modal`). Backdrop: `oklch(0 0 0 / 0.6)`.

---

## Theme Design Guide

When creating a new built-in theme, follow these principles:

### Surface Spread

Decide on a contrast philosophy:
- **Tight spread** (Grace: L 0.11-0.17) — surfaces feel unified, hierarchy comes from borders and text weight
- **Wide spread** (Hex: L 0.11-0.29) — surfaces feel layered, hierarchy is spatial and immediate

Both are valid. Tight spread is more subtle and refined. Wide spread is more dramatic and readable.

### Warm vs Cool

The system supports any temperature. Grace uses warm hue ~70-80 at very low chroma (0.004). Hex uses rose hue ~15 at moderate chroma (0.012). GitHub Dark uses cool neutrals. Everforest uses green. The structural principles work regardless of temperature.

### Accent Choice

The `--primary` token is the theme's signature color. It appears in:
- Active state tints (bg-primary/6 through bg-primary/10)
- Left indicators and bottom bars (bg-primary at full opacity)
- Primary buttons (bg-primary)
- Focus rings (var(--ring), typically matching primary)

Choose an accent that has enough contrast against the theme's background at 6-10% opacity to be perceptible but not distracting.

### Terminal Palette

Terminal colors should feel cohesive with the theme. Desaturate ANSI colors 10-15% to match the theme's overall restraint. Shift hues toward the theme's dominant undertone for coherence (e.g., Hex shifts greens and blues slightly warm).

Set `terminal.background` to `"transparent"` so the terminal inherits the app's recessed surface. Only use an opaque terminal background if the theme requires a distinct terminal color (like community themes that define their own terminal background).

---

## Consistency Checklist

These are the rules that, when violated, kill perceived quality:

- One border weight (1px) everywhere
- One hover model (background shifts to accent surface) on every hoverable element
- One focus model (border brightens to ring color) on every focusable element
- Active states always use `bg-primary/N`, never hardcoded colors
- Spacing is never approximate — if a gap is 8px, it's 8px everywhere
- Typography never drifts — use semantic utility classes, not raw sizes
- Radius never drifts — if menu items are 4px, all menu items are 4px
- Cursor types are always correct (pointer, default, text, resize, grab)
- Text selection is controlled — chrome is `user-select: none`, content is selectable
- Every interactive element has all states: default, hover, active, focused, disabled
- Every list/panel has a considered empty state
- Truncation is always ellipsis, never clip
- Nothing shifts on interaction — no reflow from hover states or badge appearances
- Theme preview cards use the theme's own colors, not the current theme's CSS variables

---

## Design References

- **Linear** — Execution benchmark. Consistent surfaces, invisible borders, speed-obsessed.
- **Antimetal** — Inspiration for Grace theme. Deep dark, cream text, premium restraint.
- **Hex.tech** — Inspiration for Hex theme. Near-black with rose editorial warmth.
- **Zed** — Minimal chrome, content-forward, sharp without being cold.
- **Warp** — Modern terminal UX as a design problem. Rich but restrained.
