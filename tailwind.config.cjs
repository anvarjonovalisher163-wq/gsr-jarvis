/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#59a1ff',
          500: '#2f7cff',
          600: '#1a5df5',
          700: '#1449e1',
          800: '#173cb6',
          900: '#19378f'
        }
      }
    }
  },
  plugins: []
}
