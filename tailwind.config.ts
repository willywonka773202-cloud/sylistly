import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light editorial palette — cream / deep black / one warm accent
        bg: '#f6f3ee', // warm cream page background
        cream: '#f6f3ee',
        sand: '#efe9df',
        'surface-1': '#ffffff', // primary cards
        'surface-2': '#f1ece4', // warm gray panel
        'surface-3': '#e6e0d5', // deeper panel / pressed
        ink: '#16140f', // deep near-black text (warm)
        'ink-soft': '#46423a',
        muted: 'rgba(22,20,15,.46)',
        'muted-2': 'rgba(22,20,15,.64)',
        hairline: 'rgba(22,20,15,.08)',
        'hairline-2': 'rgba(22,20,15,.15)',
        accent: '#e8365d', // Sylistly hot pink — the brand signature
        'accent-hot': '#ff4a72',
        'accent-soft': '#fde7ee',
        skin: '#c9a98a',
        money: '#2f7d5b',
        emerald: '#2f7d5b',
        crown: '#f0a830',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22,20,15,.04), 0 8px 24px -14px rgba(22,20,15,.18)',
        card: '0 2px 8px -3px rgba(22,20,15,.08), 0 14px 36px -18px rgba(22,20,15,.20)',
        float: '0 10px 44px -14px rgba(22,20,15,.30)',
        item: '0 16px 30px -16px rgba(22,20,15,.45)',
        'pink-glow': '0 10px 30px -8px rgba(232,54,93,.5)',
        nav: '0 8px 40px -8px rgba(22,20,15,.22)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.85rem' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in .4s ease forwards',
        'rise': 'rise .5s cubic-bezier(.22,1,.36,1) forwards',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
