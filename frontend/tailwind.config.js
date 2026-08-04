/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ONE WARM FAMILY. Every colour here sits between hue 337 and 43 — that
        // shared warmth is what makes the app read as one object instead of a
        // sticker sheet, and it's the right register for food and for something
        // inherited. Cool hues are near-absent from food branding for a reason;
        // blue is the classic appetite suppressant.
        //
        // Deleted, not deprecated: `paper`, `herb`, `growth`, `growth-bright`,
        // `soil` were the garden UI's palette and had ZERO uses after the kitchen
        // redesign — a dead colour is an invitation to reach for an abandoned
        // design. `periwinkle` (#6E7BF2, hue 234) went with them: it was the only
        // cool colour in the app, used four times, and it fought everything.
        cream: '#FBF3E2',        // app background — warm near-white
        card: '#FCF8EE',         // raised surface
        line: '#E3D9C4',         // hairline
        ink: '#2E3A24',          // primary text + every outline. NOT black: hue 93,
                                 // a deep desaturated green, which is why even the
                                 // type reads warm.
        'ink-soft': '#4A5540',   // secondary text

        // Accents, each with ONE job. Restraint is the point — five loud accents
        // reads as a promotion; this app is carrying someone's inheritance.
        terra: '#B5502A',        // ACTION: buttons, links, active nav. 4.59 on cream.
        plum: '#8A3D5A',         // A PERSON'S NAME, and nothing else.
        saffron: '#D99A2B',      // the person's-knowledge accents (story, step note)
        peach: '#FBE0A8',        // hero / story colour blocks
        sage: '#A8C69A',         // affirmative states (saved, sent, done). Replaces
                                 // mint #8FE39E, a candy green at sat 60 sitting
                                 // next to an ink at sat 23.
        brick: '#C0442F',        // emphasis bar / destructive. Replaces coral
                                 // #F96D5B, which failed contrast for cream text
                                 // (2.58) and was only 9° of hue from terra, so the
                                 // two competed for the same job.

        // Semantic alias kept because `action` reads better than `terra` at call
        // sites that mean "the interactive one".
        action: '#B5502A',
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
