/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f6ff',
          100: '#e6e9fd',
          200: '#d7ddfb',
          500: '#667eea',
          600: '#5a67d8',
          700: '#4c51bf',
        },
        secondary: {
          50: '#f8f5ff',
          500: '#764ba2',
        }
      }
    },
  },
  plugins: [],
}
