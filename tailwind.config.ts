import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        '#080807',
        'surface-1': '#0f0f0e',
        'surface-2': '#161614',
        'surface-3': '#1e1e1b',
        accent:    '#e8365d',
        'accent-hot': '#ff4a72',
        ink:       '#fffefb',
        muted:     'rgba(255,255,255,.42)',
        'muted-2': 'rgba(255,255,255,.62)',
        hairline:  'rgba(255,255,255,.07)',
        'hairline-2': 'rgba(255,255,255,.13)',
        skin:      '#c9a98a',
        money:     '#7ccea0',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pink-glow': '0 10px 24px -8px rgba(232,54,93,.6)',
      },
    },
  },
  plugins: [],
} satisfies Config;
