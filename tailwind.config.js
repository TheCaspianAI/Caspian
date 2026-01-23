/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        '3xl': '2560px', // Ultra-wide monitors
      },
      spacing: {
        // Strict spacing tokens (4px-based rhythm)
        'row-sidebar': '44px',
        'row-panel': '40px',
        'panel-pad': '20px',
        'panel-pad-lg': '24px',
        'message-gap': '16px',
        'message-pad': '14px',
      },
      fontSize: {
        // Unified Typography Scale (5 tiers) - increased line-height for readability
        'display': ['18px', { lineHeight: '1.4', fontWeight: '600' }],   // Section headers, h1
        'title': ['16px', { lineHeight: '1.45', fontWeight: '600' }],    // Subheaders, h2
        'body': ['14px', { lineHeight: '1.5', fontWeight: '450' }],      // Primary content
        'ui': ['13px', { lineHeight: '1.4', fontWeight: '500' }],        // Controls, buttons, tabs
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],   // Metadata, timestamps
        // Legacy aliases (map to new scale)
        'heading': ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        'meta': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'meta-sm': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      colors: {
        // Core Blacks (near-black range)
        'black-0': '#070709',
        'black-1': '#0B0B0E',
        'black-2': '#101014',
        'black-3': '#14141A',
        'black-4': '#1A1A22',
        // Grays (text + UI)
        'gray-100': '#E9E9EE',
        'gray-80': '#B9BAC4',
        'gray-60': '#8B8D9A',
        'gray-40': '#5A5C66',
        'gray-20': '#2A2B33',
        // Tier A: Base (near-black)
        'bg-base': '#070709',
        'bg-panel': '#0B0B0E',
        // Tier B: Stage (center - brighter)
        'bg-elevated': '#101014',
        'bg-stage': '#14141A',
        // Legacy aliases
        'bg-primary': '#070709',
        'bg-secondary': '#0B0B0E',
        // Tier C: Interactive surfaces
        'surface-primary': '#14141A',
        'surface-secondary': '#1A1A22',
        'surface-tertiary': '#1E1E26',
        'surface-hover': '#222230',
        'surface-focus': 'rgba(255, 255, 255, 0.08)',
        'surface-selected': 'rgba(255, 255, 255, 0.10)',
        // Borders - hairlines (6% opacity - consistent everywhere)
        'border-subtle': 'rgba(255, 255, 255, 0.06)',
        'border-default': 'rgba(255, 255, 255, 0.06)',
        'border-focus': 'rgba(255, 255, 255, 0.10)',
        'border-primary': 'rgba(255, 255, 255, 0.06)',
        'border-secondary': 'rgba(255, 255, 255, 0.06)',
        // Typography - refined opacity hierarchy (82/55/38/28)
        'text-primary': 'rgba(255, 255, 255, 0.82)',   // Primary body text
        'text-body': 'rgba(255, 255, 255, 0.82)',      // Same as primary for body
        'text-secondary': 'rgba(255, 255, 255, 0.55)', // Metadata, timestamps
        'text-tertiary': 'rgba(255, 255, 255, 0.38)',  // Muted labels
        'text-muted': 'rgba(255, 255, 255, 0.28)',     // Very muted
        'text-disabled': 'rgba(255, 255, 255, 0.28)',
        // Accent - pink/magenta
        'accent': '#ff7aed',
        'accent-muted': 'rgba(255, 122, 237, 0.18)',
        'accent-glow': 'rgba(255, 122, 237, 0.18)',
        // Interactive - using pink accent
        'interactive': '#ff7aed',
        'interactive-hover': '#ff9df3',
        'interactive-muted': 'rgba(255, 122, 237, 0.12)',
        'focus-ring': 'rgba(255, 122, 237, 0.35)',
        // Semantic - slightly muted
        'success': 'rgba(74, 222, 128, 0.80)',
        'warning': 'rgba(251, 191, 36, 0.80)',
        'error': 'rgba(248, 113, 113, 0.80)',
        'info': 'rgba(96, 165, 250, 0.80)',
      },
      borderRadius: {
        'panel': '14px',
        'control': '12px',
        'popover': '16px',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'fast': '140ms',
        'medium': '220ms',
      },
    },
  },
  plugins: [],
}
