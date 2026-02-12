# Caspian Design Philosophy

> The interface disappears. The work remains.

---

## Core Direction

Caspian is a supervision tool for AI coding agents. Users rotate through workspaces, scan terminal output, check progress, kick off tasks. The interface optimizes for fast scanning and instant switching — not for settling into one workspace.

The design direction is **engineered restraint**. The app communicates competence through what it doesn't do. No gradients, no glows, no decorative color. Hierarchy comes from luminosity, weight, and spatial position alone. The lasting impression should be that someone cared about every pixel — not that someone tried to impress you.

Linear is the benchmark. Not because of any specific visual choice, but because it never breaks character. You never catch it being lazy. One wrong border radius, one inconsistent hover state, one off-by-one spacing — these kill perceived quality faster than any missing feature.

### Tenets

1. **Content is king.** Terminal output and code diffs are the experience. Chrome frames them, never competes.
2. **Density without clutter.** More information in less space, but never crowded. Precision spacing is the difference.
3. **Monochrome confidence.** No accent color as a crutch. If hierarchy doesn't work in pure greyscale, it doesn't work.
4. **Seamless surfaces.** Panels flow together. Borders are felt, not seen. No boxed-in grid of sections.
5. **Instant response.** Every interaction responds within one frame. No easing that makes the user wait.

---

## Color System

Pure achromatic. Zero chroma, zero hue. The entire palette is neutral grey at different luminosity levels.

### The Tonal Range

The range is deliberately narrow. This is the single most important insight from Linear: a compressed tonal range makes everything feel cohesive. No surface jumps out. No panel looks like a separate app. Everything belongs to one unified plane.

```
Surface          oklch        hex        Role
─────────────────────────────────────────────────────────
Recessed         0.21  0 0    #181818    Terminal wells, inputs
Background       0.235 0 0    #1e1e1e    App background, sidebar
Card             0.25  0 0    #222222    Panels, toolbars
Elevated         0.275 0 0    #282828    Popovers, hover states, active items
```

The total spread from recessed to elevated is only 0.065 in oklch lightness. This is tight by design. The previous system used a 0.09 spread (#1e1e1e to #2e2e2e) which made surfaces feel like separate zones. The current range makes them feel like facets of one surface.

### Sidebar Is Background

The sidebar uses the exact same background as the content area (#1e1e1e). There is no two-tone split. Separation comes from a barely-visible border and the content structure itself, not from surface color difference. This is how Linear handles it — the sidebar and content read as one unified surface.

### Text

Primary text is soft off-white, not stark. Lower contrast equals higher quality. Stark white on near-black reads as cheap. Soft off-white on dark grey reads as refined.

```
Role             oklch        hex        Usage
─────────────────────────────────────────────────────────
Primary          0.87  0 0    #d4d4d4    Headlines, active labels, content
Secondary        0.62  0 0    #858585    Descriptions, inactive labels, meta
Tertiary         0.45  0 0    —          Placeholders, timestamps, hints
Disabled         0.30  0 0    —          Disabled states, decorative
```

### Borders

Borders are the area that most separates a premium app from a generic one. In Linear, borders are barely perceptible — they define space through a whisper of contrast. They are felt more than seen.

The approach: use opacity-based borders for structural elements, solid colors for interactive elements.

```
Context          Value                         Usage
─────────────────────────────────────────────────────────
Structural       border-border/40              Sidebar divider, tab separators, content header
                 (~#272727 at 40% opacity)     Nearly invisible against background

Interactive      var(--border) / #272727       Input borders, card outlines
                 oklch(0.273 0 0)              Visible but subtle

Focus            var(--ring) / #4a4a4a         Focus rings, active borders
                 oklch(0.41 0 0)               Clear indicator without being loud

Terminal panes   oklch(0 0 0 / 0.15)          Black at 15% opacity — adapts to any surface
Terminal focus   oklch(1 0 0 / 0.08)          White at 8% — barely there
```

The sidebar border uses #232323 (oklch 0.255), which is only 5 hex steps from the #1e1e1e background. This creates a divider you can perceive if you look for it but which doesn't create a visible line at a glance.

### Functional Colors

The only non-grey in the palette. Used strictly for semantic meaning.

```
--status-running:  oklch(0.72 0.15 145)   Green — process active
--status-error:    oklch(0.63 0.20 25)    Red — failure
--status-warning:  oklch(0.75 0.15 80)    Amber — caution
--status-info:     oklch(0.70 0.10 230)   Blue — informational
--status-done:     oklch(0.63 0 0)        Grey — completed
```

Functional colors appear only in status dots, destructive button text, git diff markers, terminal ANSI output, and error messages. They never appear as backgrounds, borders, glows, or fills on interactive elements.

---

## Typography

### Geist

Geist by Vercel. A typeface designed for developer UIs with a monospaced companion (Geist Mono). One family, total consistency between chrome and content.

Variable weight (100-900), tabular figures by default, optimized for small sizes and screen rendering. Neutral precision — no personality, no quirks. The clinical register this direction needs.

### Scale

| Role | Font | Weight | Size | Tracking | Line Height |
|------|------|--------|------|----------|-------------|
| Page heading | Geist | 600 | 20px | -0.01em | 1.2 |
| Section title | Geist | 500 | 14px | -0.005em | 1.3 |
| Body / labels | Geist | 400 | 13px | 0 | 1.5 |
| Caption / meta | Geist | 400 | 12px | 0.01em | 1.4 |
| Badge / count | Geist | 500 | 11px | 0.02em | 1.0 |
| Terminal | Geist Mono | 400 | 13px | 0 | 1.4 |
| Code / paths | Geist Mono | 400 | 12px | 0 | 1.4 |

### Rules

- 13px is the base, not 16px. This is a dense professional tool.
- Weight drives hierarchy. 600 for headings, 500 for interactive labels, 400 for body. Never above 600.
- Monospace for anything machine-generated. File paths, branch names, commit hashes — all Geist Mono.
- No italic. Use weight or opacity for emphasis.
- Tight line heights for chrome (1.2-1.3), generous for readable content (1.5).

---

## Surfaces and Depth

Surfaces are cut into the interface, not floating above it. Think instrument panel — gauges sit in recessed wells, flush with or below the surface.

### Three Levels

1. **Recessed** — Terminal panes, text inputs. Content sits *in* the interface. Uses `var(--input)` (#181818) with `inset 0 1px 2px oklch(0 0 0 / 0.3)`.

2. **Flush** — The default plane. Background, sidebar, panels. Everything lives here. Defined by hairline borders, not surface color difference.

3. **Raised** — Temporary overlays only. Popovers, dropdowns, modals. Uses `var(--popover)` (#282828) with `0 4px 12px oklch(0 0 0 / 0.3)`.

Structural elements never use drop shadows. Cards and panels are defined by borders. The glass effect (backdrop-filter) is not used.

---

## Borders and Radius

### Border Weight

1px. Everywhere. No 2px borders, no thick dividers. One weight.

### Border Visibility

This is where most dark UI designs go wrong. Borders that are too visible create a grid of boxes that fights the content. Borders that are invisible lose all structure. The target: borders you perceive without noticing.

For structural borders (sidebar divider, tab separators, content header underline), use `border-border/40` — the border color at 40% opacity. This creates separation that's felt rather than seen.

For interactive borders (input fields, card outlines), use `var(--border)` at full opacity. These need to be visible to communicate interactivity.

For terminal pane borders, use `oklch(0 0 0 / 0.15)` — semi-transparent black that adapts to any surface and never draws attention.

### Radius Scale

```
0px    — Structural: terminal wells, panel dividers
3px    — Small interactive: badges, chips
6px    — Standard interactive: buttons, inputs, tabs
8px    — Containers: cards
10px   — Overlays: modals, popovers (maximum)
```

No `rounded-full` anywhere except status dot indicators.

---

## Motion

### Speed

Animations exist to prevent spatial disorientation, not to delight.

```
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

---

## Terminal

Terminals are the primary content. Their presentation is the most important visual element.

### Well Treatment

- Background: `var(--input)` (#181818) — recessed
- Inner shadow: `inset 0 1px 2px oklch(0 0 0 / 0.3)`
- Pane border: `1px solid oklch(0 0 0 / 0.15)` — nearly invisible
- Focused pane border: `oklch(1 0 0 / 0.08)` — subtle white, not a bright ring
- Radius: 0px. Sharp edges. Terminal wells are architectural.
- Padding: 0px. Content goes edge-to-edge.

### Terminal Colors

- Text: #cccccc (slightly dimmer than UI text)
- Cursor: #d4d4d4 (solid block, no blink)
- Selection: #404040 (grey, no color)
- ANSI colors: standard palette desaturated 10-15% to fit the monochromatic environment

### Toolbar

The terminal header bar ("Terminal" label) uses `var(--tertiary)` (#222222), which is barely different from the background. Focused pane toolbar uses `var(--secondary)` (#282828). The toolbar should blend in, not stand out.

---

## Components

### Buttons

**Primary:** Soft-white fill (#d4d4d4), dark text (#1e1e1e). No border. 6px radius. Hover: slight dim. Active: further dim. No glow.

**Secondary:** #282828 fill, #d4d4d4 text. 1px #272727 border. Hover: lighten background.

**Ghost:** No fill, no border. Hover: #282828 fill.

**Destructive:** Transparent fill, #c04040 text. Hover: error color at 10% opacity fill.

### Inputs

Background: #181818 (recessed). Border: 1px #272727. Focus: border shifts to #4a4a4a. Radius: 6px. No focus ring glow — just a border brightness shift.

### Dropdown Menus

Background: #282828 (elevated). Border: 1px #272727. Shadow: raised surface shadow. Radius: 8px container, 4px items.

### Modals

Background: #222222. Border: 1px #272727. Shadow: raised surface. Radius: 10px. Backdrop: `oklch(0 0 0 / 0.6)`, no blur.

---

## Consistency Checklist

These are the rules that, when violated, kill perceived quality:

- One border weight (1px) everywhere
- One hover model (background shifts one step) on every hoverable element
- One focus model (border brightens to ring color) on every focusable element
- Spacing is never approximate — if a gap is 8px, it's 8px everywhere
- Typography never drifts — if body is Geist 400 13px, it's that everywhere
- Radius never drifts — if buttons are 6px, all buttons are 6px
- Cursor types are always correct (pointer, default, text, resize, grab)
- Text selection is controlled — chrome is `user-select: none`, content is selectable
- Every interactive element has all states: default, hover, active, focused, disabled
- Every list/panel has a considered empty state
- Truncation is always ellipsis, never clip
- Nothing shifts on interaction — no reflow from hover states or badge appearances

---

## CSS Variable Reference

These are the actual values in the design system. The theme store applies hex values from `caspian.ts` via inline styles, overriding the oklch defaults in `globals.css`.

```css
/* Surfaces */
--background:       oklch(0.235 0 0);    /* #1e1e1e */
--card:             oklch(0.25 0 0);     /* #222222 */
--popover:          oklch(0.275 0 0);    /* #282828 */
--secondary:        oklch(0.275 0 0);    /* #282828 */
--accent:           oklch(0.275 0 0);    /* #282828 */
--muted:            oklch(0.25 0 0);     /* #222222 */
--tertiary:         oklch(0.25 0 0);     /* #222222 */
--tertiary-active:  oklch(0.275 0 0);    /* #282828 */
--input:            oklch(0.21 0 0);     /* #181818 */

/* Text */
--foreground:       oklch(0.87 0 0);     /* #d4d4d4 */
--muted-foreground: oklch(0.62 0 0);     /* #858585 */

/* Borders */
--border:           oklch(0.273 0 0);    /* #272727 */
--ring:             oklch(0.41 0 0);     /* #4a4a4a */

/* Sidebar (matches background — no two-tone) */
--sidebar:          oklch(0.235 0 0);    /* #1e1e1e */
--sidebar-border:   oklch(0.255 0 0);    /* #232323 */

/* Status */
--status-running:   oklch(0.72 0.15 145);
--status-error:     oklch(0.63 0.2 25);
--status-warning:   oklch(0.75 0.15 80);
--status-info:      oklch(0.7 0.1 230);
--status-done:      oklch(0.63 0 0);
```

### Architecture Note

The theme store (`applyUIColors` in `css-variables.ts`) sets CSS custom properties as inline styles on `document.documentElement`. This means the hex values in `caspian.ts` override the oklch defaults in `globals.css`. The oklch values are fallbacks for when no theme is applied. Both must stay in sync.

Do not create intermediate CSS variables that reference other variables (e.g., `--bg-base: var(--background)`). This creates a two-layer token system that breaks theme switching, because `applyUIColors` only sets the shadcn-layer variables.

---

## Design References

- **Linear** — The benchmark. Monochromatic dark, seamless surfaces, invisible borders, speed-obsessed.
- **Zed** — Minimal chrome, content-forward, sharp without being cold.
- **Warp** — Modern terminal UX as a design problem. Rich but restrained.
- **Figma** — Panel management, workspace navigation, information density.
