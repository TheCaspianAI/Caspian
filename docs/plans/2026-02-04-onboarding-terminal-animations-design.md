# Onboarding Terminal Animations Design

## Overview

Replace the current simple node cards in the onboarding screen with animated mini-terminal previews that demonstrate each value prop in action.

## Current State

The `OnboardingScreen.tsx` displays three static cards with icons and labels:
- "Fix bugs"
- "Add feature"
- "Write tests"

## Proposed Change

Each card becomes a realistic animated terminal showing relevant commands and output.

## Component: AnimatedTerminal

### Props
```typescript
interface AnimatedTerminalProps {
  title: string;           // e.g., "node-1"
  script: TerminalLine[];  // Lines to animate
  delay?: number;          // Start delay (for staggering)
}

interface TerminalLine {
  type: 'command' | 'output' | 'success' | 'error' | 'diff-add' | 'diff-remove';
  text: string;
  pauseAfter?: number;     // ms to wait after this line
}
```

### Visual Design

```
┌─────────────────────────────┐
│ ● ● ●      node-1          │  ← Title bar with traffic lights
├─────────────────────────────┤
│ $ git diff src/auth.ts     │  ← Command (green $, white text)
│ - const token = null       │  ← Diff remove (red)
│ + const token = getToken() │  ← Diff add (green)
│ █                          │  ← Blinking cursor
└─────────────────────────────┘
```

### Colors
- Background: `bg-card` or `bg-[#0a0a0a]`
- Border: `border-border/60`
- Prompt `$`: `text-primary`
- Commands: `text-foreground`
- Output: `text-muted-foreground`
- Diff red: `text-red-400`
- Diff green: `text-green-400`
- Success: `text-green-400`

### Sizing
- Card dimensions: `w-48 h-40` (192px × 160px)
- Font: `text-xs` monospace (12px)

## Animation Behavior

### Typing Effect
- Command characters: 40-60ms intervals
- Output characters: 20-30ms intervals
- Cursor blink: 530ms intervals
- Pause after command: 300ms before output appears

### Looping
- Script plays through completely (~4-5 seconds)
- Pause 2 seconds on final frame
- Soft fade and restart (continuous loop)

### Orchestration
- Cards fade in with existing stagger (0.5s, 0.6s, 0.7s delays)
- Terminal typing begins after card fade-in completes
- Each terminal runs independently (not synchronized)

## Terminal Scripts

### Card 1: "Fix bugs"
```
$ git status
modified: src/api/auth.ts

$ npm test
✗ 1 test failed

$ caspian fix auth.ts
Fixed null reference error

$ npm test
✓ All tests passing
```

### Card 2: "Add feature"
```
$ caspian add login-page
Creating components...
  + src/pages/Login.tsx
  + src/hooks/useAuth.ts
  + src/api/auth.ts

✓ 3 files created
```

### Card 3: "Write tests"
```
$ caspian test auth
Generating tests...

$ npm test src/auth
  ✓ validates token
  ✓ handles expiry
  ✓ refreshes session

✓ 3 tests passed
```

## Implementation Plan

1. Create `AnimatedTerminal.tsx` component with typing animation logic
2. Create `useTypingAnimation` hook to manage character-by-character reveal
3. Define terminal scripts as data constants
4. Replace current node cards in `OnboardingScreen.tsx` with AnimatedTerminal instances
5. Adjust card sizing and spacing as needed

## Dependencies

- Framer Motion (already installed, already imported in OnboardingScreen)
- No new dependencies required
