/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#123B49', 600: '#1A4D5E', 700: '#0E2F3A', 800: '#0A242C' },
        paper: '#F7F9F8',
        income: { DEFAULT: '#14866D', soft: '#E3F3EE' },
        expense: { DEFAULT: '#C94E55', soft: '#FAE8E9' },
        gold: { DEFAULT: '#D9AA58', soft: '#F8EFDD' },
      },
      fontFamily: {
        display: ['Alexandria', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'Tahoma', 'sans-serif'],
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.15rem' },
      boxShadow: {
        card: '0 1px 2px rgba(18,59,73,.05), 0 6px 20px rgba(18,59,73,.06)',
      },
    },
  },
  plugins: [],
};
