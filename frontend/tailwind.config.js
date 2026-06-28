import animate from 'tailwindcss-animate'

const ok = (name) => `oklch(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: ok('border'),
        input: ok('input'),
        ring: ok('ring'),
        background: ok('background'),
        foreground: ok('foreground'),
        primary: {
          DEFAULT: ok('primary'),
          foreground: ok('primary-foreground'),
        },
        secondary: {
          DEFAULT: ok('secondary'),
          foreground: ok('secondary-foreground'),
        },
        destructive: {
          DEFAULT: ok('destructive'),
          foreground: ok('destructive-foreground'),
        },
        muted: {
          DEFAULT: ok('muted'),
          foreground: ok('muted-foreground'),
        },
        accent: {
          DEFAULT: ok('accent'),
          foreground: ok('accent-foreground'),
        },
        popover: {
          DEFAULT: ok('popover'),
          foreground: ok('popover-foreground'),
        },
        card: {
          DEFAULT: ok('card'),
          foreground: ok('card-foreground'),
        },
        sidebar: {
          DEFAULT: ok('sidebar'),
          foreground: ok('sidebar-foreground'),
          primary: ok('sidebar-primary'),
          'primary-foreground': ok('sidebar-primary-foreground'),
          accent: ok('sidebar-accent'),
          'accent-foreground': ok('sidebar-accent-foreground'),
          border: ok('sidebar-border'),
          ring: ok('sidebar-ring'),
        },
        chart: {
          1: ok('chart-1'),
          2: ok('chart-2'),
          3: ok('chart-3'),
          4: ok('chart-4'),
          5: ok('chart-5'),
        },
        // Domain status colors (kept from the original homestay-manager theme)
        status: {
          occupied: '#22c55e',
          available: '#f3f4f6',
          arrival: '#eab308',
          checkout: '#3b82f6',
          dirty: '#ef4444',
          overbooked: '#a855f7',
        },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) * 1.8)',
      },
      fontFamily: {
        sans: ['Geist Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Geist Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
