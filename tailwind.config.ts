import type { Config } from 'tailwindcss';

/**
 * Sylistly "Editorial Noir" design system.
 * Single source of truth for color, type, radius, and elevation tokens.
 * Existing token names (bg, accent, ink, muted, surface-*, hairline, money)
 * are preserved so every page inherits the refresh; new tokens add the bolder
 * editorial layer (champagne, accent ramp, type scale, radii, shadows).
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fit Scroll design-system ramp (founder spec 2026-06-10).
        bg:          '#0D0D0F',
        'surface-1': '#17171A',
        'surface-2': '#1F1F23',
        'surface-3': '#2A2A2F',
        'surface-4': '#34343A',
        // One unified, confident accent.
        accent:      '#FF2D6D',
        'accent-hot':'#FF5C8A',
        'accent-deep':'#C5174F',
        'accent-soft':'rgba(255,45,109,.14)',
        // Champagne — the luxe secondary used sparingly for premium cues.
        champagne:   '#E7C79B',
        'champagne-deep':'#B8945E',
        'champagne-soft':'rgba(231,199,155,.12)',
        ink:         '#FBF7F2',
        muted:       'rgba(251,247,242,.55)',
        'muted-2':   'rgba(251,247,242,.68)',
        hairline:    'rgba(251,247,242,.08)',
        'hairline-2':'rgba(251,247,242,.15)',
        skin:        '#c9a98a',
        money:       '#82E0A6',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans:  ['var(--font-satoshi)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Editorial scale — larger, calmer, intentional.
        'display':  ['2.75rem', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
        'display-lg':['3.5rem', { lineHeight: '0.92', letterSpacing: '-0.025em' }],
        'headline': ['2rem',    { lineHeight: '1.02', letterSpacing: '-0.015em' }],
        'title':    ['1.375rem',{ lineHeight: '1.12', letterSpacing: '-0.01em' }],
        'lede':     ['1.0625rem',{ lineHeight: '1.55' }],
        'eyebrow':  ['0.6875rem',{ lineHeight: '1', letterSpacing: '0.2em' }],
      },
      borderRadius: {
        card: '1.5rem',
        'card-lg': '2rem',
        sheet: '1.75rem',
      },
      boxShadow: {
        'pink-glow': '0 10px 30px -8px rgba(255,45,109,.55)',
        card: '0 18px 44px rgba(0,0,0,.34)',
        'card-strong': '0 26px 64px rgba(0,0,0,.46)',
        float: '0 22px 60px rgba(0,0,0,.5)',
      },
      keyframes: {
        'sy-rise': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sy-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'sy-rise': 'sy-rise 320ms cubic-bezier(.2,.8,.2,1) both',
        'sy-fade': 'sy-fade 240ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
