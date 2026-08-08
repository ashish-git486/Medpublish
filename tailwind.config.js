/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#10263B',
          light: '#1B3A55',
        },
        teal: {
          50: '#EAF5F4',
          100: '#D2EAE8',
          600: '#0F6B65',
          700: '#0B534F',
        },
        gold: {
          500: '#C98A2E',
          600: '#B07523',
        },
        paper: '#F5F7F7',
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
