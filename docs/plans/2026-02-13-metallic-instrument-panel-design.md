# Design: Metallic Instrument Panel

Redesign the default Caspian theme and component styles to shift from clinical monochromatic to a warm, premium dark aesthetic inspired by Antimetal. Gold/champagne accent on matte dark surfaces -- brass hardware on black metal.

## Decisions

- **Accent**: Gold/champagne (`oklch(0.78 0.11 85)`) for primary actions, active indicators, focus rings
- **Font**: Keep Geist (no change)
- **Surfaces**: Subtle depth via gradient tinting and warm border glow on hover. No noise/grain texture.
- **Scope**: Replace default Caspian theme + update component styles. Other themes untouched.

## Color System

### Backgrounds (warm hue shift, hue ~60, very low chroma)

| Token | Current | New |
|-------|---------|-----|
| `background` | `oklch(0.235 0 0)` | `oklch(0.22 0.005 60)` |
| `card` | `oklch(0.25 0 0)` | `oklch(0.24 0.005 60)` |
| `popover` | `oklch(0.275 0 0)` | `oklch(0.27 0.006 60)` |
| `input` | `oklch(0.21 0 0)` | `oklch(0.19 0.004 60)` |
| `border` | `oklch(0.32 0 0)` | `oklch(0.30 0.008 65)` |
| `secondary` | `oklch(0.275 0 0)` | `oklch(0.27 0.006 60)` |
| `muted` | `oklch(0.25 0 0)` | `oklch(0.24 0.005 60)` |
| `tertiary` | `oklch(0.25 0 0)` | `oklch(0.24 0.005 60)` |
| `tertiary-active` | `oklch(0.275 0 0)` | `oklch(0.27 0.006 60)` |

### Gold Accent

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `oklch(0.78 0.11 85)` | Primary buttons, active indicators |
| `primary-foreground` | `oklch(0.20 0.01 60)` | Text on gold buttons |
| `ring` | `oklch(0.78 0.11 85)` | Focus rings (rendered at reduced opacity) |
| `accent` | `oklch(0.30 0.015 70)` | Hover backgrounds, selected states |
| `accent-foreground` | `oklch(0.85 0.04 80)` | Text on accent surfaces |

### Text (warm whites)

| Token | Current | New |
|-------|---------|-----|
| `foreground` | `oklch(0.87 0 0)` | `oklch(0.88 0.01 80)` |
| `nav-foreground` | `oklch(0.75 0 0)` | `oklch(0.73 0.008 75)` |
| `muted-foreground` | `oklch(0.62 0 0)` | `oklch(0.58 0.006 65)` |
| `card-foreground` | `oklch(0.87 0 0)` | `oklch(0.88 0.01 80)` |
| `popover-foreground` | `oklch(0.87 0 0)` | `oklch(0.88 0.01 80)` |
| `secondary-foreground` | `oklch(0.87 0 0)` | `oklch(0.88 0.01 80)` |
| `accent-foreground` | `oklch(0.87 0 0)` | `oklch(0.85 0.04 80)` |

### Sidebar (matches main surfaces)

| Token | Current | New |
|-------|---------|-----|
| `sidebar` | `oklch(0.235 0 0)` | `oklch(0.22 0.005 60)` |
| `sidebar-foreground` | `oklch(0.87 0 0)` | `oklch(0.88 0.01 80)` |
| `sidebar-primary` | `oklch(0.87 0 0)` | `oklch(0.78 0.11 85)` |
| `sidebar-primary-foreground` | `oklch(0.235 0 0)` | `oklch(0.20 0.01 60)` |
| `sidebar-accent` | `oklch(0.275 0 0)` | `oklch(0.30 0.015 70)` |
| `sidebar-accent-foreground` | `oklch(0.87 0 0)` | `oklch(0.85 0.04 80)` |
| `sidebar-border` | `oklch(0.3 0 0)` | `oklch(0.30 0.008 65)` |
| `sidebar-ring` | `oklch(0.41 0 0)` | `oklch(0.78 0.11 85)` |

### Destructive (unchanged)

`oklch(0.63 0.2 25)` -- red stays red.

### Status Colors (unchanged)

Running (green), error (red), warning (yellow), info (blue) remain functional colors.

### Chart Colors (warm-shifted)

| Token | Current | New |
|-------|---------|-----|
| `chart-1` | `oklch(0.5 0 0)` | `oklch(0.50 0.006 65)` |
| `chart-2` | `oklch(0.6 0 0)` | `oklch(0.60 0.008 70)` |
| `chart-3` | `oklch(0.7 0 0)` | `oklch(0.70 0.010 75)` |
| `chart-4` | `oklch(0.4 0 0)` | `oklch(0.40 0.005 60)` |
| `chart-5` | `oklch(0.55 0 0)` | `oklch(0.55 0.007 68)` |

## Component Style Changes

### Buttons

- **Primary**: Gold fill (`primary`), dark text (`primary-foreground`). Hover: slight brightness increase.
- **Secondary**: Warm border, transparent bg. Hover: border brightens toward gold, bg fills with `accent`.
- **Ghost**: Transparent. Hover: `accent` background.
- **Destructive**: Unchanged (red).

### Borders

- Default border gets warm undertone via the token change.
- Hover states: border shifts toward gold accent (`oklch(0.78 0.11 85 / 0.15)` glow).
- Active/focused: gold ring at reduced opacity.

### Cards

- Background uses warm-shifted `card` token.
- Hover: border gains faint gold glow via `box-shadow: 0 0 0 1px oklch(0.78 0.11 85 / 0.08)`.
- No background gradients on cards themselves -- depth comes from the token layering.

### Tab Indicators

- Active tab indicator bar shifts from neutral to gold accent.

### Sidebar

- Active node: `sidebar-accent` background with `sidebar-accent-foreground` text.
- Primary actions: gold via `sidebar-primary`.

### Surface Depth (globals.css)

- **Main background**: Faint radial gradient overlay from center (slightly lighter/warmer) to edges, creating ambient depth. Applied via `background-image` on the root element.
- **Elevated surfaces**: Slightly stronger warm undertone via `popover` token + subtle box-shadow.
- **Recessed surfaces**: Deeper/cooler via `input` token. The recessed-to-elevated contrast improves.

### Focus Rings

- Gold-tinted ring: `ring` token set to the gold accent, applied at framework-standard opacity.

## What Does NOT Change

- Geist font family, all typography sizes/weights/tracking
- Border radii (6px interactive, 10px modal, 0px structural)
- Animation timing (80ms)
- Layout structure (sidebar, panes, tabs, mosaic)
- Other themes (Nord, GitHub Dark, GitHub Light, Rose Pine, Everforest)
- Functional status colors
- Terminal ANSI color palette (keep desaturated)

## Reference

- Primary reference: [Antimetal](https://antimetal.com/)
- Aesthetic: brass hardware on matte black surfaces
- Philosophy: "Composed Velocity" -- calm on the surface, precision underneath
