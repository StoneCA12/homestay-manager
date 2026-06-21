/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        status: {
          occupied: '#22c55e',
          available: '#f3f4f6',
          arrival: '#eab308',
          checkout: '#3b82f6',
          dirty: '#ef4444',
          overbooked: '#a855f7',
        },
      },
    },
  },
  plugins: [],
}
