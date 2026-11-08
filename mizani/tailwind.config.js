/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#02343F', 600: '#0A4654', 700: '#01262E', 800: '#011B21' },
        paper: '#F7F5E6',
        cream: '#F0EDCC',
        plum: '#331B3F',
        mint: { DEFAULT: '#ACC7B4', soft: '#E3EEE6' },
        income: { DEFAULT: '#14866D', soft: '#E3F3EE' },
        expense: { DEFAULT: '#C94E55', soft: '#FAE8E9' },
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
