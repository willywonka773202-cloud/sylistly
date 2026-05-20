import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: '#27272A',
        input: '#27272A',
        ring: '#8B5CF6',
        background: '#0A0A0B',
        foreground: '#FAFAFA',
        primary: {
          DEFAULT: '#8B5CF6',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#27272A',
          foreground: '#FAFAFA',
        },
        muted: {
          DEFAULT: '#18181B',
          foreground: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#8B5CF6',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#111113',
          foreground: '#FAFAFA',
        },
        zinc: {
          950: '#09090B',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.3)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.3)',
        'glow-green': '0 0 30px rgba(16, 185, 129, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config
