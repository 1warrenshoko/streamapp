/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        oswald: ['Oswald', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        ufc: {
          red: '#d20a0a',
          darkred: '#a00808',
          gold: '#d4af37',
          darkgold: '#b8960f',
          black: '#0a0a0a',
          darker: '#050505',
          surface: '#141414',
          card: '#1a1a1a',
          border: 'rgba(255,255,255,0.08)',
          text: '#9ca3af',
          muted: '#6b7280'
        }
      }
    }
  },
  plugins: []
};
