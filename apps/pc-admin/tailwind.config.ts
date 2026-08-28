import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-bg-base)',
        surface: 'var(--color-bg-surface)',
        accent: 'var(--color-accent-primary)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        subtle: 'var(--color-border-subtle)',
      },
      boxShadow: {
        luxury: 'var(--shadow-luxury)',
      },
      fontFamily: {
        display: ['Cinzel', 'Noto Serif SC', 'Songti SC', 'serif'],
        sans: ['Inter', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
