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
        // NO handwritten face. Caveat, Shantell Sans, Patrick Hand, Architects
        // Daughter and Kalam were each tried for a person's story and their step
        // remarks, and all five were wrong for the same three reasons:
        //
        //   1. It's body content, not decoration. The story and the step remarks
        //      are the most valuable text in the app — often read on a phone, in a
        //      kitchen, by someone cooking the dish for the first time. A display
        //      face for content you rely on is a legibility cost paid for a mood.
        //   2. The handwriting is a lie. `Step.voice_note` is typed into a plain
        //      <input> by whoever wrote the recipe down. Styling it as handwriting
        //      implies a scanned card or the source person's own hand; neither
        //      exists. A typeface shouldn't make a claim the data can't support.
        //   3. It reads as a consumer novelty. No serious recipe product renders
        //      user content in a script face — it's the visual shorthand for a
        //      craft-store template, and it undercuts the care in the rest of this
        //      design.
        //
        // A person's voice is signalled STRUCTURALLY instead — the saffron card,
        // the quote stamp, the attributed heading, Fraunces italic at a size that
        // sits apart from the instructions. Same intent, no legibility tax, and
        // two families instead of three.
        //
        // If a handwritten face is ever wanted again, use it for a CHROME accent
        // (a label, a badge) and never for content someone has to follow.
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
