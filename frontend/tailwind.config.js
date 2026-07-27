/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Garden palette (R1) — green is the ambient lead; terra is the action accent.
        paper: '#F3EAD6',        // warm cream app background
        card: '#FCF8EE',         // surface
        ink: '#2E3A24',          // deep leaf — primary text
        'ink-soft': '#4A5540',   // green-gray — secondary text
        line: '#E3D9C4',         // hairline
        terra: '#B5502A',        // warm action accent
        saffron: '#D99A2B',      // vitality sparks
        herb: '#5C7A3F',         // (kept as alias of the lead green)
        plum: '#8A3D5A',         // the person / heritage accent
        soil: '#C9A277',         // garden ground
        // Semantic roles: green = grow/ambient, terra = do/act
        action: '#B5502A',       // = terra — buttons, links, active states
        growth: '#5C7A3F',       // lead green — plants, growth, garden ambient, eyebrows
        'growth-bright': '#7FA05A', // leaf highlights, plant accents
        // "Kamala's Recipes"-inspired accents for the redesigned Home color-blocking.
        cream: '#FBF3E2',        // pale header cream (near-white warm)
        peach: '#FBE0A8',        // hero band peach/butter
        coral: '#F96D5B',        // red-coral accent bar / tags
        periwinkle: '#6E7BF2',   // playful blue seal
        mint: '#8FE39E',         // donate-pill green
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        // Fraunces — the chunky high-contrast display serif for big Home titles
        // (matches the "Kamala's Recipes" reference). Serif stays Cormorant.
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'cursive'],
      },
      boxShadow: {
        warm: '0 2px 10px rgba(120, 80, 40, 0.10)',
        'warm-lg': '0 12px 32px rgba(80, 50, 20, 0.18)',
      },
      maxWidth: {
        app: '430px',
      },
    },
  },
  plugins: [],
}
