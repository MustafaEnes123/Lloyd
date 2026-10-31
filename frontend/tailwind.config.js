/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        cyber: {
          bg: '#060811',
          panel: 'rgba(13, 18, 34, 0.72)',
          cyan: '#00f0ff',
          magenta: '#ff2a85',
          violet: '#7c3aed',
          emerald: '#10b981',
        },
      },
    },
  },
  plugins: [],
};
