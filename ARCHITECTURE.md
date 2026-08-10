# Architecture

Issei is a full-stack app for sending one recipe from the person who cooks it to
the person who just tasted it and asked for it (*issei* = "first generation").
A recipe here is attributed to a person, its imprecise measures are preserved
verbatim rather than normalized, and the knowledge an ingredient list can't hold
lives as a note on the individual step. The recipient reads the whole thing from
a capability link with no account. The UI is a warm, playful "kitchen" (bold
sticker / color-block design). This file is a practical map of how that codebase
is organized and what each piece does. For the positioning and the explicit list
of things the app does *not* do, see `POSITIONING.md`.

> **Note on the "garden" era.** An earlier UI rendered each recipe as a plant
> that grew seed→sprout→sapling→tree, and the Kitchen as a garden of those
> plants. That UI was replaced by the current kitchen design. The backend still
> *computes* growth fields (`growth_stage`/`growth_vitality` via
> `services/growth.py`) and returns them on `RecipeResponse`, but the frontend
> no longer surfaces them. The old garden-era docs are archived under
> `docs/archive/garden/`, and the full garden UI lives at the `garden-v1` tag.

> **Note on the removed lineage model.** Recipes used to form generational trees
> (`parent_recipe_id`, a `ghost_ancestors` table, `lineage_relation`, root-bound
> visibility, `GET /recipes/{id}/lineage`, `services/lineage.py`). That was
> removed in commit `8a3b734`: the app is a bridge between two people, not a
> family network. **There are no ancestors, descendants, roots, branches or
> subtrees anywhere in the current code.** `services/lineage.py` is now
> `services/sharing.py`; on the frontend `api/lineage.js` is now `api/sharing.js`
> and `lib/lineagePayload.js` is now `lib/originPayload.js`. The one thing kept
> is `Recipe.origin_attribution` — the "from Lola" byline, which is a fact about
> one recipe rather than an edge between two.

For *why* the backend is built the way it is (tech choices, design trade-offs),
see `README.md`. For planned features, see `FUTURE.md`. This file is the
"where does X live and what does it do" reference.

The project has two halves:

- **Backend** (`app/`) — a FastAPI REST API. Stores data, enforces auth, does
  the recipe math. Talks to PostgreSQL (prod) / SQLite (local).
- **Frontend** (`frontend/`) — a React single-page app. The UI users actually
  touch. Talks to the backend over HTTP.

They are completely separate programs. The frontend runs in the browser; the
backend runs on a server. They communicate only through HTTP requests (JSON).

---

## Backend (`app/`)

FastAPI app. The request flow is layered: a request hits a **router**, which
validates input against a **schema**, calls into a **service** (for business
logic) or directly queries a **model**, and returns a **schema** as JSON.

```
HTTP request
   ↓
router  (app/routers/)      endpoint definitions, auth checks
   ↓
schema  (app/schemas/)      validate request, shape response (Pydantic)
   ↓
service (app/services/)     business logic — scaling, conversions
   ↓
model   (app/models/)       database tables (SQLAlchemy ORM)
   ↓
database (Postgres / SQLite)
```

| File / folder | What it does |
|---|---|
| `main.py` | App entry point. Creates the FastAPI app, configures CORS, and mounts all the routers. This is what `uvicorn` runs. |
| `config.py` | Reads settings from the `.env` file (database URL, JWT secret, token lifetime, Cloudinary keys) into a typed `settings` object. |
| `database.py` | Sets up the SQLAlchemy engine + session. Auto-detects SQLite vs Postgres. `get_db` is the dependency that hands each request a database session. |
| `auth.py` | Password hashing (bcrypt), JWT creation/decoding, and `get_current_user` — the dependency that protects endpoints by requiring a valid token. |
| `models/` | **ORM models** — Python classes mapping to database tables. Eight, one file per table: `user`, `recipe` (carries `origin_attribution` — the byline — and `visibility`), `ingredient`, `ingredient_section`, `step` (carries `voice_note`, a plain `Text` column holding the typed note for that step — **not audio**, see below), `cook_event` (carries `note` — a cook's variation), `handoff` (carries `token` — a capability secret for the invite link), `feedback` (an in-app feedback note). |
| `schemas/` | **Pydantic models** — define the JSON shape of requests and responses, separately from the DB models. Keeps internal fields (like password hashes) from leaking to the API. |
| `routers/` | **Endpoint definitions**, grouped by domain: `auth` (signup/login/me — signup also auto-accepts pending recipe invites addressed to the new user's email), `recipes` (CRUD + scaling + browse + cook + handoff, plus sharing: `/recipes/shared` and `/recipes/handoffs/{id}/accept`, plus the invite flow: `GET /recipes/invite/{token}` — unauthenticated *full* read of a handed-off recipe; `POST /recipes/invite/{token}/claim` — authenticated grant claim by token), `upload` (Cloudinary photos), `feedback` (in-app feedback notes, self-scoped). `recipes` also carries `POST /recipes/parse`, which structures a spoken/pasted recipe into fields via an LLM and saves nothing. `main.py` also serves an unauthenticated `GET /health`. **22 routes total** across **4 routers** — count them with `grep -rn "^@router\.\|^@app\." app/`; the full table is in `README.md`. |
| `services/` | **Business logic**, decoupled from HTTP. `scaling.py` (the precise/imprecise/unmeasured quantity math), `folk_units.py` (the folk/body/vessel unit vocabulary — see below), `growth.py` (`soul_count`, `growth_stage`, `growth_vitality` — still computed and returned on `RecipeResponse`, but **no UI displays them** since the garden was removed), `sharing.py` (`can_view`, the single read-authorization rule — public **or** owner **or** an accepted grant on that recipe — plus `effective_visibility`, now just the recipe's own visibility since there is no tree to inherit from). `quantity.py` (server-side classification of a written amount into precise/imprecise/unmeasured, sharing the `folk_units` vocabulary so the model's output is graded by the app, not by the model). `recipe_ai.py` (the OpenRouter call behind `POST /recipes/parse` — a strict-schema extraction that preserves imprecise amounts verbatim and falls back to a local parser when unavailable). |

**Folk units, and why scaling has three cases rather than two.** `folk_units.py`
holds the vocabulary of units that name a *vessel* or a *gesture* instead of a
measurement, and splits it in the one way that matters at scale time:

- **Countable** (`FOLK_UNITS`) — the vessel is unknowable but the count is real.
  "3 soup spoons" doubled genuinely is "6 soup spoons", and `FOLK_PLURALS` makes
  it read like a person wrote it ("2 knobs of butter", not "2.0 knob").
- **Non-linear** (`NON_LINEAR_UNITS`) — the number is a geometry, not a quantity.
  "3 fingers of water" is a depth in the pot; doubling the rice widens the pot,
  so the depth barely moves. These are kept verbatim and the cook is handed the
  multiplier (`scale_note`) to apply by feel.

Anything else imprecise scales but is marked `(approximate)` rather than posing
as a measurement. `frontend/src/utils/quantity.js` uses the same vocabulary to
classify an amount as imprecise at *entry* time; the two lists must stay in sync.

**Sharing model (the "Shared" tier).** Passing a recipe *is* sharing — there is no separate access-grant concept. The `handoffs` table doubles as the grant: passing a private recipe to someone creates a `Handoff` on **that recipe**, with `state` in `pending | accepted` and a `token` (a `secrets.token_urlsafe(32)` capability secret). In-app recipients are accepted instantly; email invites stay `pending` until that address signs up (then they auto-accept). Additionally, any holder of the invite token can **claim** the grant (via `POST /recipes/invite/{token}/claim`) — this resolves the mismatched-email orphan case (an invite addressed to one email claimed by someone who signed up with another). `can_view` in `sharing.py` is the single rule every recipe read funnels through (`get_recipe`, scale, cook, handoff) — keep it that way; a second, subtly different rule elsewhere is how private recipes leak. `GET /recipes/shared` lists a user's accepted-grant recipes; `RecipeResponse.shared_with_count` tells an owner how many people a private recipe is shared with (count only — no identities).

**Read is not write.** A grantee gets **view + cook only**. They cannot edit or delete the owner's recipe, and cannot re-share it: `patch_recipe` and `delete_recipe` both filter `Recipe.user_id == current_user.id` (so a non-owner gets a 404), and `handoff_recipe` requires ownership too. `can_view` deliberately does not answer "may edit" — that question is settled separately, in the router. Nothing in this app lets a recipient add to a recipe they were sent; keeping and cooking it is the whole promise.

**The invite read is open — the token is the capability.** A recipient holding an invite link (`/invite/:token`) reads the **full** recipe with no account: ingredients, sections, steps and their per-step remarks, the story, servings, description, cuisine, cover photo. This was formerly a soft wall (name/story/photo only, signup required to see an ingredient), which inverted the point — the person on the far end of a handoff has never tasted the dish and wants to cook it. The `token` is a `secrets.token_urlsafe(32)` capability secret; holding the link *is* the permission to read. What the `InvitePreview` schema still withholds is the *account*, not the dish: the owner's private `notes` scratchpad and any user/author ids. Signing up is what unlocks keeping, cooking, and adding to it — after signup/login the token is claimed and becomes a durable grant.

**Models vs Schemas — the distinction that trips people up.** A *model*
(`models/recipe.py`) is the database table. A *schema* (`schemas/recipe.py`) is
the API contract. They look similar but serve different masters: the model has
every column (including ones you never expose); the schema has only what the API
should accept or return. `RecipeCreate` (what you send to create) and
`RecipeResponse` (what you get back) are different schemas for the same model.
`RecipeResponse` also includes derived values (`cook_count`, `owner_cook_count`,
`last_cooked_at`, `shared_with_count`, `soul_count`, `growth_stage`,
`growth_vitality`) that are computed per-request in `_attach_growth_fields`, not
stored columns. The frontend uses some of these (e.g. `cook_count`); the
`growth_*` / `soul_count` fields are computed but no longer displayed since the
garden UI was removed. There are no `child_count` or `has_grandchildren` fields —
those were lineage counts and went with the tree.

**`alembic/`** (sibling of `app/`, not inside it) — database migrations. Every
time a model changes (new column, etc.), you generate a migration here and apply
it to keep the real database schema in sync. Files in `alembic/versions/` are
the ordered history of schema changes.

---

## Frontend (`frontend/`)

A **React** app built with **Vite** (the dev server + build tool) and styled
with **Tailwind CSS**. If React is new to you, the mental model is:

- The UI is built from **components** — JavaScript functions that return markup
  (JSX, which looks like HTML inside JS). A page is just a big component made of
  smaller ones.
- Components hold **state** with the `useState` hook (a "hook" is a function
  starting with `use` that plugs into React's features). When state changes,
  React re-renders that component automatically. You never manually touch the
  DOM.
- `useEffect` runs code *after* render — used here mostly to fetch data from the
  backend when a page first loads.

### Folder layout

```
frontend/
├── index.html              the single HTML page everything mounts into
├── package.json            dependencies + npm scripts (dev, build)
├── vite.config.js          build tool config
├── tailwind.config.js      design tokens: colors, fonts, max-width
└── src/
    ├── main.jsx            entry point — mounts <App> into index.html
    ├── App.jsx             route table — maps URLs to pages
    ├── index.css           Tailwind imports + custom utilities
    ├── api/
    │   ├── client.js       the axios HTTP client + toUserMessage (error copy)
    │   └── sharing.js      recipe/sharing endpoint calls (cook, handoff, invite)
    ├── components/         reusable UI pieces (used across pages)
    ├── pages/              one component per screen / route
    ├── lib/                non-UI logic (measure labels, payload builders)
    ├── utils/              non-UI helper logic
    └── test/               Vitest setup
```

### How a page actually loads (the data flow)

1. The browser loads `index.html`, which loads `main.jsx`.
2. `main.jsx` wraps everything in `<BrowserRouter>` (enables URL routing) and
   renders `<App>`.
3. `App.jsx` looks at the current URL and renders the matching **page**
   component (e.g. `/my-recipes` → `MyRecipes.jsx`).
4. That page, on mount, calls the backend via `client` (axios) — e.g.
   `client.get('/recipes')`.
5. The response data goes into component **state**; React renders the list.

### Key files

| File | What it does |
|---|---|
| `main.jsx` | The true entry point. Mounts the app and enables routing. You rarely touch this. |
| `App.jsx` | The **route table**. Each `<Route>` maps a URL path to a page component. Protected routes are wrapped in `<ProtectedRoute>` and `<Layout>` (which adds the bottom nav); `/login` is wrapped in `<PublicOnlyRoute>`; `/invite/:token` is fully public and gets no chrome. When you add a page, you add a route here. |
| `api/client.js` | A single configured **axios** instance — the *only* thing that talks to the backend. It auto-attaches the JWT token to every request (request interceptor) and, on any 401 response, clears the session and redirects to login (response interceptor). It also exports **`toUserMessage(err, fallback)`**, the one place an axios failure becomes a sentence a user reads: a FastAPI 422 arrives as an array of objects (rendering it raw once printed `[object Object]` at someone who had merely chosen a short password), so this reports every failing field, deduped, passes a router's deliberate `detail` string through untouched, and distinguishes "no response at all" (offline/CORS/timeout) from "the server said no" — never blaming a password for a dead connection. Import `client` anywhere you need data; route error copy through `toUserMessage`. |
| `api/sharing.js` | Recipe + sharing endpoint calls (`plantRecipe`, `deleteRecipe`, `cookRecipe`, `handoffRecipe`, `setVisibility`, `getSharedWithMe`, `getInvitePreview`, `claimInvite`) built on `client`. Was `api/lineage.js`; the tree it was named for is gone. |
| `index.css` | Pulls in Tailwind and defines the shared **sticker design system** — `.sticker` / `.sticker-press` (ink outline + hard offset shadow), `.field`, `.btn-primary`, `.chip`, `.error-pill`, `.section-label`, `.story-callout`, plus the Steps counter and `scrollbar-hide`. |

### `components/` — reusable pieces

The UI uses a shared **"sticker" design language** (bold ink outlines, hard
offset shadows, saturated color-block fields, chunky Fraunces display type),
factored into small reusable components. The core `.sticker` / `.field` /
`.btn-primary` / `.error-pill` utilities live in `index.css`.

| Component | Role |
|---|---|
| `ProtectedRoute.jsx` | A gate. If there's no token in localStorage, it redirects to `/login`. Wraps every authenticated route. |
| `PublicOnlyRoute.jsx` | The mirror of `ProtectedRoute`: keeps a signed-**in** user off `/login` (`replace`, so it doesn't leave the sign-in screen in history). The exception is an invite link — a signed-in visitor arriving at `/login?invite=TOKEN` would silently drop the token, so it claims the invite for the session in hand and lands them on the recipe instead. |
| `BottomNav.jsx` | The floating "sticker pill" bottom nav (Home, Browse, Add, Kitchen, You). Inactive tabs are icon-only; the active tab expands into a terra color-blob with its label; Add is a raised scalloped badge. |
| `RecipeCard.jsx` | A recipe as a sticker card — cover photo in an ink-outlined frame, cuisine tag, chunky title, byline (`from <source>` / `kept by <author>`, name emphasized). `variant` `grid` (two-up) or `row` (horizontal scroll). |
| `RecipeBody.jsx` | The always-readable recipe body, shared by the owner's recipe page and the public invite landing: cover, byline + cuisine + **servings**, the short **description**, the **story** as a featured peach card (headed "{Name}'s story" + quote stamp), **ingredients** (imprecise amounts tagged "their way" via `lib/measures.js`), and **steps** (each optional `voice_note` rendered as a saffron callout labelled **"a note on this step"**). Each step's numeral doubles as a **check-off control** (`doneSteps`) — session-only state, deliberately not persisted; a checked step dims and its note card presses in with it. A cooking-mode toggle strips everything but ingredients and steps; rich is the default. **Label honesty:** the two labels above used to read "In X's words" and "their words", which claimed both a recording and verbatim speech. Neither exists — `voice_note` is typed by whoever wrote the recipe down. Don't reintroduce that wording; tests assert against it. |
| `CoverImage.jsx` | Renders a recipe's cover photo, or a peach `issei.` placeholder when there's no photo. Shared by every screen that shows a recipe. |
| `HandoffInvite.jsx` | Pass-it-on, in two stages. **Compose:** an optional note and an optional email (the email adds auto-accept when that address signs up) — neither is required, so the fast path is one tap to mint a link. **Share:** the actual invite URL, handed to `navigator.share` (iMessage / WhatsApp / anything) with a copy-link fallback where the share sheet doesn't exist. The share stage is the point of the component: the token used to be minted and dropped, so the recipient was never told. `onDone` fires only after sharing, not on send. Copy adapts to the recipe's visibility — access-granting for a private recipe, a nudge for a public one. |
| `RecipeForm.jsx` | Shared create/edit form body, reused by PlantRecipe and EditRecipe. Marker-titled sections with persistent `FieldLabel`s and paired name-vs-measurement / step-vs-step-note fields. Handles photo upload incl. iPhone HEIC → JPEG conversion (lazy-loaded `heic2any`). Errors go through `toUserMessage`. |
| `VisibilityControl.jsx` | Owner-only private/public toggle on the recipe page ("Only me" / "Everyone", copy kept in step with `VisibilityChoice`). One surviving italic line names what "Everyone" exposes — the only place a user learns public means "listed in Browse", which round-2 testers were specifically anxious about. Note it still reads `recipe.parent_recipe_id` / `recipe.child_count` for a branch/descendants case; those fields no longer exist on the API response, so the guards are dead code that resolves to the root path — harmless, but it is leftover lineage, not a feature. |
| `SourceFields.jsx` | Who the recipe came from, folded into the **top** of the add form rather than standing as its own screen (it used to be a full step; testers found the add flow too effortful and one abandoned mid-way, so removing a screen was the cheapest real win). Feeds `origin_attribution`. |
| `RecipeGlimpse.jsx` | A miniature, non-interactive sample of a recipe as the app actually renders it — used on the post-signup Welcome. A definition describes a category of person and never shows what the product *does*, so this shows the two genuinely different things instead: an amount left in the cook's own words ("3 soup spoons" + a "their way" pill) and a per-step note. Its styling is deliberately duplicated from `RecipeBody` rather than shared, so a layout change on the real reading surface can't silently reshape the pitch. |
| `IsseiMeaning.jsx` | The name glossed in one clause ("the first of a family to arrive somewhere new — usually the one who never wrote any of it down"), with 一世 in a pill. One source, because it appears at both cold entry points (the login panel and the bottom of an invite landing) and a name explained two different ways is a name nobody learns. |
| `IconField.jsx` | A labeled input with a leading icon (`.field--icon`). |
| `VisibilityChoice.jsx` | The *create-time* sibling of `VisibilityControl` — an "only me / everyone" choice at the bottom of the add-recipe form (passed in as `RecipeForm`'s `beforeSubmitSlot`). Private is preselected; sharing stays opt-in. Its copy names the consequence ("shows up in Browse") rather than the app's own vocabulary, which user testing showed people couldn't decode. |
| `MarkerTitle.jsx` | A heading with a highlighter-swipe color block behind the text (the app's section-header motif). |
| `HeroCard.jsx` / `HeroStack.jsx` | The Home hero: a swipeable deck of recipe cards (`HeroStack`) built from `HeroCard` faces. Replaced the old decorative-disc hero. |
| `EmptyState.jsx` / `Loader.jsx` | Shared sticker-styled empty/no-results state (peach card + emoji badge) and loading state (bouncing pot badge). |
| `BackButton.jsx` | Icon-only sticker back button for sub-pages. |
| `Icon.jsx` / `IconField.jsx` | The inline-SVG line-icon set and a labeled input field. |
| `FilterSelect.jsx` | A custom sticker-styled dropdown (used for the Browse cuisine/diet/ready-in filters). |
| `FieldLabel.jsx` | A persistent field label (stays visible after a field is filled), shared by RecipeForm and the capture flow. |

### `pages/` — one per screen

| Page | Route | Purpose |
|---|---|---|
| `Login.jsx` | `/login` | Login + signup (tabs). One of the two public routes (the other is `/invite/:token`). Sticker masthead, peach "meaning of issei" definition card, and a "forgot password → email me" line (no self-serve reset yet). Replaces history on sign-in, so Back doesn't return to the sign-in screen. |
| `Home.jsx` | `/` | Greeting + a peach hero (with decorative dish discs) that opens the Kitchen, a coral "N recipes to cook" bar, and marker-titled sections of recipe cards (community "passed down lately" + "your kitchen"). Welcome empty state on first run. |
| `Browse.jsx` | `/browse` | Discovery: search + Cuisine / Diet / Ready-In sticker dropdowns. Unfiltered → curated horizontal cuisine/recency rows; searching or filtering → a flat results grid (section titles hide). |
| `MyRecipes.jsx` | `/my-recipes` | The Kitchen — a grid of your recipe cards with a search field; links to "Shared with you". Empty/no-match states use `EmptyState`. |
| `SharedWithMe.jsx` | `/shared` | Recipes others have passed to the user (accepted grants only; no accept UI). |
| `RecipePage.jsx` | `/recipes/:id` | The recipe page — a centered title over `<RecipeBody>` (story leads as a featured card; each step's `voice_note` renders as an "a note on this step" callout; steps can be checked off as you cook, session-only; **imprecise measures** are tagged "their way" via `lib/measures.js`, never normalized). For the owner: `<VisibilityControl>`, "Pass it on", and a delete button with a confirm dialog. |
| `PlantRecipe.jsx` | `/add` | Stepped add-a-recipe flow: choose a doorway (recipe passed down to you vs. one of your own) → origin details (with persistent field labels + stamps) → RecipeForm, which carries `<VisibilityChoice>` (only a name is required) → a "saved" confirmation that names the next acts (cook it · add its story · pass it on) → HandoffInvite. The confirmation's secondary CTA lands on the new recipe page. |
| `EditRecipe.jsx` | `/recipes/:id/edit` | Edit an existing recipe (shared RecipeForm). |
| `HandoffPage.jsx` | `/recipes/:id/handoff` | A dedicated page for passing a recipe on, rather than a cramped inline form. Loads the recipe for its name/visibility/source, renders `<HandoffInvite>`, and pops back (`navigate(-1)`) on send or skip so it doesn't build a back-and-forth history loop. |
| `InviteLanding.jsx` | `/invite/:token` | **Public** recipient landing: the far end of a handoff. Reads the whole recipe via the unauthenticated invite endpoint and renders the same `<RecipeBody>` the owner sees, cooking mode and all — no signup wall. A "keep it in your kitchen" CTA sits *after* the recipe (where intent is highest, once they know they want it) and carries the token to Login. Failures are diagnosed rather than blamed on the link: only a server 404 means the link is genuinely dead; anything else is retryable. |
| `Profile.jsx` | `/profile` | The "You" page — account info, client-side settings (reduce-motion, cooking-mode default), account actions (stubbed "Soon"), a "Send feedback" button routing to the in-app `/feedback` form, and logout. |
| `Welcome.jsx` | `/welcome` | The post-signup intro — two panels, once, then never again (seen-state in `lib/prefs.js`). Teaches the app *after* signup rather than on the sign-in screen, using `<RecipeGlimpse>` (a real-looking sample recipe) and `<IsseiMeaning>`. A route rather than an overlay on Home, because Home can't render until three API calls answer — an overlay would make a new user watch a spinner before being taught anything. Protected, but pointedly **not** wrapped in `Layout`: no bottom nav, since a tab bar invites wandering off mid-explanation. Self-redirects to Home once seen. |

(Removals, so nobody hunts for them: **`AddRecipe.jsx` is gone** — `/add` maps to `PlantRecipe`. **Remix** was removed entirely — page, API helper, and backend endpoint. **The shopping list** and `services/units.py` were removed (see `FUTURE.md` for why). **The lineage model** was removed in `8a3b734` — no `parent_recipe_id` substrate remains. The garden-era plant/growth components — `Plant`, `GardenBed`, `GardenPlant`, `LivingPlant`, `SoulSheet`, `Provenance`, `SectionHeader`, and the `growth`/`gardenBands`/`plantedBeat` libs + `useGrowthAnimation` hook — were removed in the kitchen redesign; they live at the `garden-v1` tag.)

### `lib/` — non-UI logic

| File | What it does |
|---|---|
| `measures.js` | `isImprecise` / `impreciseLabel` — flags imprecise/unmeasured ingredient amounts so the recipe page tags them "their way" (celebrated as fidelity, never normalized). |
| `handoffStarters.js` | `HANDOFF_STARTERS` (two starter objects: fill-in + sharing) and `defaultStarterKey(sourceName)` — logic for the one-tap note starters + the safe auto-touch when passing back to the recorded source. |
| `sourceName.js` | `sourceNameOf(recipe)` — extracts the recorded source's name from `origin_attribution` (leading segment before `·`). Used for recipe bylines + the auto-preselect on HandoffInvite. |
| `originPayload.js` | Builds the origin request payload sent to the backend (`buildOriginPayload`). Was `lineagePayload.js`. |
| `prefs.js` | The client-side preferences bag — one `issei_prefs` localStorage object (`PREFS_KEY`, `loadPrefs`, `setPref`) holding display toggles and the Welcome seen-flag. Deliberately one bag, not a second onboarding-only key, so "clear site data" resets every client-side preference together and two keys can't disagree about what a fresh user is. |

### `utils/` — non-UI logic

| File | What it does |
|---|---|
| `quantity.js` | Parses a free-text quantity ("1 1/2 cups", "a dash", "1½ tbsp") into the structured fields the backend needs (value, unit, type). Classifies `imprecise` from two signals, not one: hedge markers ("about", "roughly", "~") **and** a `FOLK_UNITS` vocabulary of vessel/body/gesture units (soup spoon, pinch, handful, splash, fingers…), matched word-bounded and longest-first against the unit remainder. Without the folk list, "3 soup spoons" would be classed precise and scale into "7.5 soup spoons". Keep this vocabulary in sync with `app/services/folk_units.py`. |

### Conventions to follow

- **Auth storage:** JWT in `localStorage` under `issei_token`; the user object
  under `issei_user`.
- **All API calls go through `src/api/client.js`** — never call `fetch`/axios
  directly, or you lose the token attachment and 401 handling.
- **Function components + hooks only** — no class components.
- **Tailwind only** — no UI libraries. Use the design tokens in
  `tailwind.config.js` (`cream`, `peach`, `coral`, `saffron`, `mint`,
  `periwinkle`, `terra`, `ink`, `plum`, etc.) rather than raw hex.
- **Two typefaces, both loaded** — `font-display` (Fraunces) for headings and
  most UI, `font-sans` (Nunito Sans) for body. Those are the only two families
  in `index.html`. **There is no `font-hand`**: Caveat, Shantell Sans, Patrick
  Hand, Architects Daughter and Kalam were each tried for the story and the step
  notes and all five were cut — it's content someone cooks from (a legibility
  cost paid for a mood), and the data is typed text, so a script face implies a
  recording that doesn't exist. A person's presence is signalled *structurally*
  instead: the saffron card, the quote stamp, the attributed heading, Fraunces
  italic. (`font-serif`/Cormorant Garamond does still exist as a key, but it is
  legacy and deliberately **not loaded** — don't use it.)
  `tailwind.config.test.js` pins these invariants: no `hand` family, and every
  family the app references must actually be loaded in `index.html` — a
  referenced-but-unloaded font falls back to a system face and fails silently.
- **Mobile-first**, max-width 430px centered.

---

## The two halves, connected

```
Browser ──────────────── Server ──────────── Database
React app                FastAPI app          Postgres (Neon)
(frontend/)              (app/)               via SQLAlchemy
   │                        │
   │  client.js (axios)     │  routers → schemas → services → models
   └──── HTTP/JSON ─────────┘
        e.g. GET /recipes
        Authorization: Bearer <JWT>
```

- The frontend never touches the database. It only makes HTTP calls.
- The JWT (issued at login) rides along on every request so the backend knows
  who you are.
- Local dev: frontend on `localhost:5173`, backend on `localhost:8000`. CORS in
  `main.py` allows that origin to call the API.

---

## Development notes

- **Backend changes that touch the database** (new/changed model fields) need an
  Alembic migration *and* application to the production database — these aren't
  automatic. Watch for them when reviewing changes.
- **Two servers must be running to use the app locally**: `uvicorn app.main:app
  --reload` (backend) and `npm run dev` in `frontend/` (frontend).
- **Verifying changes:** backend has `pytest` (**187 tests** across `tests/`);
  frontend has Vitest + React Testing Library (**481 tests in 33 files**) — run
  `npm test` (`vitest run`) in `frontend/`. `npm run build` still catches
  syntax/import errors. These counts move; re-run both suites rather than
  quoting a number from a doc.
- **A note on honesty in docs.** Several rounds of feature *removal* (the garden
  UI, remix, the shopping list, `services/units.py`, the whole lineage model)
  left these documents describing an app that no longer existed. When you remove
  something, correct `README.md`, `ARCHITECTURE.md`, `FUTURE.md` and `CLAUDE.md`
  in the same pass, and check the explicit don't-claim list in `POSITIONING.md`.
  The two standing traps: **there is no audio in this product** (`voice_note` is
  a typed `Text` column, so never write "voice", "recording" or "in their own
  words" in user- or recruiter-facing text), and **recipes do not form trees**.
