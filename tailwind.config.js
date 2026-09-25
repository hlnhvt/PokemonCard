import defaultColors from 'tailwindcss/colors'

// Theme-aware colours: the neutral `slate` scale and the light accent shades read CSS
// variables set per theme in src/index.css (dark / light / ocean), so existing classes
// such as bg-slate-900 or text-amber-400 adapt without touching every component.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`
const SLATE_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const slate = Object.fromEntries(SLATE_SHADES.map((s) => [s, themed(`slate-${s}`)]))
const ACCENTS = ['amber', 'cyan', 'rose', 'red', 'emerald', 'indigo', 'blue', 'yellow']
const accents = Object.fromEntries(
  ACCENTS.map((c) => [c, { ...defaultColors[c], 300: themed(`${c}-300`), 400: themed(`${c}-400`) }])
)

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate,
        ...accents,
        poke: {
          red: '#EE1515',
          darkred: '#CC0000',
          blue: '#3B4CCA',
          yellow: '#FFDE00',
          gold: '#B3A125',
          dark: '#0f172a',
          card: '#1e293b'
        },
        type: {
          fire: '#FF4422',
          water: '#3399FF',
          grass: '#77CC55',
          electric: '#FFCC33',
          psychic: '#FF5599',
          ice: '#66CCFF',
          dragon: '#7766EE',
          dark: '#775544',
          fairy: '#EE99EE',
          normal: '#AAAA99',
          fighting: '#BB5544',
          flying: '#8899FF',
          poison: '#AA5599',
          ground: '#DDBB55',
          rock: '#BBAA66',
          bug: '#AABB22',
          ghost: '#6666BB',
          steel: '#AAAABB',
        }
      },
      animation: {
        'scanner-line': 'scannerMove 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
        'spin-slow': 'spin 12s linear infinite',
        'fadeIn': 'fadeIn 0.3s ease-out both',
      },
      keyframes: {
        scannerMove: {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.9' },
          '50%': { transform: 'translateY(280px)', opacity: '0.4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
