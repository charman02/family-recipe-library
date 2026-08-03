# Issei

**Live app:** https://issei-delta.vercel.app · **API + interactive docs:** https://family-recipe-library.onrender.com/docs · **Source:** https://github.com/charman02/issei

> Both are on free tiers — allow up to ~1 minute for the API to cold-start on the first request, then it's responsive.

## What It Is
Someone cooked you something you'd never had before, and you asked for the recipe. **Issei is how they send it to you** — not a scrubbed list of grams, but the dish the way they actually make it, with the parts that are "a good splash" left as "a good splash," and their notes on the steps that matter. They write it down once; you get a link and read the whole thing without making an account.

The name is the reason it's built this way: *Issei* (一世) means "first generation" — the first of a family to arrive somewhere new, and usually the one who never wrote any of it down. The recipe app market splits into utility organizers (Paprika, AnyList) and legacy archives (StoryWorth, "heirloom cookbook" products), and **both assume you already know the dish.** Nobody is built for the person who has never tasted it. See [POSITIONING.md](POSITIONING.md).

So a recipe here is attributed to a **person** — the dish is the title, the person is the byline ("from Lola") — and their imprecise measurements ("a dash," "three soup spoons," "until it smells right") are preserved verbatim and celebrated as fidelity rather than normalized away. The knowledge that an ingredient list can't hold lives as a note on the individual step it belongs to. The UI is a warm, playful "kitchen": bold color-block stickers, chunky display type, and food-forward illustration, mobile-first.

Under the hood that's a full CRUD REST API with JWT auth, a domain-driven fuzzy-quantity model, serving-size scaling that refuses to invent precision, photo upload (with automatic iPhone HEIC → JPEG conversion), and a capability-token sharing system over private → shared → public visibility.

**Stack at a glance:** React + Vite + Tailwind SPA (Vercel) → FastAPI + SQLAlchemy REST API (Render) → PostgreSQL (Neon). JWT auth, 21 endpoints, 8 data models, 422 automated tests (136 pytest + 286 Vitest).

## Tech Stack
**FastAPI** - automatic request validation via Pydantic, auto-generated /docs page for testing, and async-ready. Faster to build with than Flask for the backend API.

**SQLAlchemy** - ORM that maps Python classes to database tables. Lets me write queries in Python while being database-agnostic - same code runs on SQLite locally and Postgres in production.

**Alembic** - versioned database migrations that track schema changes across environments. Works natively with SQLAlchemy.

**Pydantic** - data validation and serialization at the API boundary. Separating request/response schemas from database models prevents accidentally leaking sensitive fields like hashed passwords.

**PostgreSQL (Neon)** - production database. Handles concurrent writes reliably, unlike SQLite. Hosted on Neon's free tier.

**bcrypt** - industry-standard password hashing. Deliberately slow to resist brute-force attacks; includes automatic salting to defeat rainbow table attacks.

**python-jose** JWT creation and verification for stateless authentication. Tokens are signed with a secret key and include expiry - no server-side session storage needed.

**pytest** - backend tests (100) for the scaling service and its folk-unit vocabulary, and the authorization surface (visibility, sharing/grants, the invite-token flow, signup validation).

**Vitest + React Testing Library** - frontend unit/component tests (202 in 22 files: quantity parsing, imprecise-measure labelling, handoff/invite flows, form and page components, plus design-token invariants). Run with `npm test` in `frontend/`.

**Cloudinary** - hosts recipe photos uploaded through the `/upload` endpoint.

**React + Vite + Tailwind CSS** - the frontend single-page app (`frontend/`), with **axios** for API calls and **React Router** for client-side routing. Mobile-first, talks to the backend over HTTP.

**Render + Vercel** - the two deployment platforms, both wired to GitHub: the FastAPI backend auto-deploys to **Render** and the React SPA auto-deploys to **Vercel** on every push to `main`. The frontend reaches the backend via a build-time `VITE_API_URL` env var, and the backend's allowed CORS origins are env-driven — so hosts can change without a code edit.

## Key Engineering Decisions
**Fuzzy quantity modeling:** Ingredients store both `quantity_text` (always preserved verbatim) and optional `quantity_value` and `unit` fields, with a `quantity_type` of "precise", "imprecise", or "unmeasured". The alternative was storing only exact measurements, but Asian home cooking rarely uses precise quantities — "a dash of fish sauce" and "3 soup spoons" are how recipes are actually passed down. The three-type model lets the scaling service handle each case appropriately: precise quantities scale mathematically, imprecise quantities scale approximately, unmeasured quantities don't scale at all.

Classification is deliberately not just hedge-word detection ("about", "roughly", "~"). It also recognizes **folk, body, and vessel units** — "3 soup spoons", "a pinch", "a good splash", "two fingers of water" — because a clean number in front of a fuzzy vessel is still a fuzzy amount. Those split further at scale time (`app/services/folk_units.py`): a *countable* folk unit has a real count, so "3 soup spoons" doubled honestly is "6 soup spoons"; a *non-linear* one describes a geometry rather than a quantity, so "3 fingers of water" is kept verbatim and the cook is handed the multiplier instead of an invented number. Without this, the app's own headline example would be normalized into "7.5 soup spoons" — exactly the behavior it exists to refuse.

**Denormalized `recipe_id` on ingredients:** Ingredients store `recipe_id` directly even though they could derive it through `section_id → ingredient_sections → recipe_id`. This is a deliberate denormalization. Without it, fetching all ingredients for a recipe requires a join through sections — and sectionless ingredients (where `section_id` is null) would be unreachable entirely. The direct `recipe_id` makes the common query simple and fast: `WHERE recipe_id = ?`.

**Single transaction with `db.flush()` for mid-transaction IDs:** Creating a recipe with nested ingredients and steps happens in a single database transaction — all inserts succeed or all are rolled back. Within that transaction, `db.flush()` is called after creating the recipe and each ingredient section to get their auto-generated IDs without committing. Those IDs are then set on child rows (`recipe_id`, `section_id`) before the final `db.commit()`. Without `flush()`, the IDs wouldn't exist in Python yet and the foreign key assignments would fail.

**Soft delete:** Recipes are soft-deleted by setting a `deleted_at` timestamp rather than removing the row. Hard delete was simpler to implement, but losing a family recipe permanently is unacceptable for this use case. All queries filter `WHERE deleted_at IS NULL`, and recovery is possible by clearing the timestamp.

**JWT stateless auth:** Authentication uses JWT tokens rather than server-side sessions. Sessions require storing state on the server and a session store (like Redis), which adds infrastructure complexity. JWTs are self-contained — the token encodes the user ID and expiry, and any server instance can verify it using just the secret key.

**Deleting features that fought the premise.** Two systems were built, shipped, and then removed on purpose, which is the decision I'd most want to be asked about.

A *consolidating shopping list* summed ingredients across recipes. Summing means normalizing amounts, which is exactly what this app exists to refuse — on its most common data it produced `"a good splash + a glug"`, which is not a total, just two lines concatenated. It also depended on a hand-maintained density table that only ever grew when someone noticed a wrong number, and because no screen ever called it, a crash, several wrong totals, and an inverted conversion ratio all lived in it undetected. Deleted along with `services/units.py`, rather than polished.

A *lineage tree* modeled recipes as a generational graph (`parent_recipe_id`, a `ghost_ancestors` table, root-bound visibility, a `/lineage` endpoint). The product is a bridge between two people — one dish, handed to one person — not a family network, and the tree was carrying architectural weight for a story the app wasn't telling. Removing it collapsed authorization from "walk to the lineage root, then match grants against that root" to a single statement about the recipe in front of you (`can_view` in `app/services/sharing.py`). The simplification was verified safe against production data first: zero recipes had a `parent_recipe_id`, so `root_of()` was already the identity function on every real row and no authorization outcome could change. The one piece kept was `origin_attribution` — the "from Lola" byline — because attribution is a fact about one recipe, not an edge in a tree.

**Validation at the boundary, error copy in one place.** A person's name is load-bearing here — every recipe carries a byline — so `UserCreate` (`app/schemas/user.py`) strips whitespace and then requires one character, which rejects `""` and `"   "` with the same rule; password length is capped at 72 bytes because that's bcrypt's own ceiling and anything longer is silently truncated. The rules live on the *input* model only: tightening `UserResponse` too would turn an already-stored blank name into a 500 on read, punishing an old account for a rule it predates. On the client, `toUserMessage` in `frontend/src/api/client.js` is the single funnel that turns any axios failure into a sentence — a FastAPI 422 arrives as an array of objects, and rendering it raw once put `[object Object]` in front of a user who had simply chosen a short password. It reports every failing field rather than the first, and distinguishes "no response at all" (offline) from "the server said no", so a user on a dead connection isn't told their password is wrong.

## API Endpoints
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | /health | No | Liveness check. Returns `{"status": "ok"}`. |
| POST | /auth/signup | No | Creates a new user account. Returns id, email, and created_at. |
| POST | /auth/login | No | Verifies credentials and returns a JWT access token. |
| GET | /auth/me | Yes | Returns the currently authenticated user. |
| POST | /recipes | Yes | Creates and returns a new recipe. |
| GET | /recipes | Yes | Returns the current user's recipes. |
| GET | /recipes/{recipe_id} | Yes | Returns the queried recipe. |
| GET | /recipes/{recipe_id}/scale?servings={n} | Yes | Returns the recipe scaled to the target serving size. |
| PATCH | /recipes/{recipe_id} | Yes | Modifies the queried recipe. |
| DELETE | /recipes/{recipe_id} | Yes | Deletes the queried recipe. |
| POST | /recipes/{recipe_id}/cook | Yes | Logs a cook event; returns updated cook_count. |
| POST | /recipes/{recipe_id}/handoff | Yes | Passes the recipe on (owner only). A recipient is **optional**: with an in-app user or an email the grant is addressed to them; with neither it is "link-only" — it mints a shareable invite token the sender passes along however they already talk to that person. On a **private** recipe the grant confers access (view + cook, never edit). |
| GET | /recipes/shared | Yes | Returns recipes shared *with* the current user (accepted grants; excludes their own). |
| POST | /recipes/handoffs/{handoff_id}/accept | Yes | Claims a pending invite for the current user (backend-only; the two auto-accept paths cover the in-app cases, so there is no MVP UI for this). |
| GET | /recipes/invite/{token} | No | Unauthenticated read of a handed-off recipe — the **full** recipe (ingredients, steps, per-step remarks, story, servings, description), no account required. The owner's private `notes` and account ids are the only things withheld. |
| POST | /recipes/invite/{token}/claim | Yes | Claims an invite by its token, granting the current user access (resolves the mismatched-email case). |
| GET | /recipes/browse | No | Public discovery feed (root-visibility gated). |
| POST | /upload/recipe-photo | Yes | Uploads a photo to Cloudinary (recipe cover or a step). |
| POST | /feedback | Yes | Files a feedback note from inside the app. |
| GET | /feedback | Yes | Returns **only the caller's own** notes. |
| GET | /recipes/ingredient-suggestions | Yes | The caller's own ingredient vocabulary, for autosuggest. |

*18 routes as committed — the table is the whole surface. This count has changed several times as features were removed, so verify rather than trust it: `grep -rn "^@router\.\|^@app\." app/` (router decorators + `GET /health`, declared on the app itself in `app/main.py`).*

**Three visibility tiers — Private → Shared → Public.** A recipe is viewable by a user when: its visibility is `public`, **or** they own it, **or** they hold an accepted handoff (grant) on it. "Shared" is not a stored enum value — `visibility` stays `private | public`; a private recipe with ≥1 accepted grant *is* shared with those people. In-app grants are accepted instantly; email invites are pending until the invitee signs up with the matching email, at which point they auto-accept. `can_view` (`app/services/sharing.py`) is the single read-authorization rule every recipe read funnels through. **Read is not write:** editing and deleting stay owner-only, enforced by a `user_id` filter in `patch_recipe`/`delete_recipe` — a grantee can read and cook a recipe they were handed, never change someone else's record of it.

**The invite token is a capability.** Those three tiers govern *accounts*; a handoff link is a separate axis. `secrets.token_urlsafe(32)` is unguessable, and holding it is the permission to read — so `/recipes/invite/{token}` serves the whole recipe with no account at all. The recipient of a handoff has never tasted the dish and wants to cook it, so gating ingredients behind a signup form would be friction at the moment of highest intent. Signing up is what lets them *keep* it (save, cook, add to it), not what lets them read it.

## Setup Instructions
1. **Clone the repo:**
```
git clone https://github.com/charman02/issei.git
cd issei
```
2. **Create and activate venv (Mac/Linux):**
```
python3 -m venv venv
source venv/bin/activate
```
3. **Install dependencies:**
```
pip install -r requirements.txt
```
4. **Create .env file in project root with:**
```
DATABASE_URL=sqlite:///./recipes.db
JWT_SECRET=your-secret-here
```
5. **Run migrations:**
```
alembic upgrade head
```
6. **Start the server:**
```
uvicorn app.main:app --reload
```
7. **Visit:**
```
http://localhost:8000/docs
```

### Frontend
The React frontend lives in `frontend/`. Run it alongside the backend (both servers must be running locally).
1. **Install dependencies:**
```
cd frontend
npm install
```
2. **Start the Vite dev server (on :5173):**
```
npm run dev
```
3. **Build for production:**
```
npm run build
```
4. **Run the frontend test suite:**
```
npm test
```

## Future Roadmap
See [FUTURE.md](FUTURE.md) for planned features including multi-user family sharing, iOS mobile app, translation support, and richer photo/video support.

## Live Demo
- **App (React frontend):** https://issei-delta.vercel.app — sign up and it works end to end: create a recipe (with a photo), keep it in your kitchen, scale it, pass it on. The handoff link opens the full recipe with no account, which is the path worth trying.
- **API (FastAPI, interactive Swagger docs):** https://family-recipe-library.onrender.com/docs — every endpoint is callable in-browser.

**Deployment:** the frontend is hosted on **Vercel** (static SPA build, auto-deploys on push to `main`); the backend is hosted on **Render** (auto-deploys on push to `main`) and talks to a **Neon** PostgreSQL database. CORS origins are env-driven so the frontend host can change without a code edit.

Note: both run on free tiers — the API may take ~1 minute to cold-start on first load, then it's responsive.
