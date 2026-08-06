# Issei

**Live app:** https://issei-delta.vercel.app · **API + interactive docs:** https://family-recipe-library.onrender.com/docs · **Source:** https://github.com/charman02/issei

> Both run on free tiers — allow up to ~1 minute for the API to cold-start on the first request, then it's responsive.

Someone cooked you something you'd never had before, and you asked for the recipe. **Issei is how they send it to you** — not a scrubbed list of grams, but the dish the way they actually make it, with the parts that are "a good splash" left as "a good splash," and their notes on the steps that matter. They write it down once; you get a link and read the whole thing without making an account.

The name is the reason it's built this way: *Issei* (一世) means "first generation" — the first of a family to arrive somewhere new, and usually the one who never wrote any of it down. The recipe app market splits into utility organizers (Paprika, AnyList) and legacy archives (StoryWorth, "heirloom cookbook" products), and **both assume you already know the dish.** Nobody is built for the person who has never tasted it. See [POSITIONING.md](POSITIONING.md).

| | |
|---|---|
| **Stack** | React 18 + Vite 5 + Tailwind SPA (Vercel) → FastAPI + SQLAlchemy REST API (Render) → PostgreSQL (Neon) |
| **API surface** | 21 endpoints, 8 data models, JWT auth |
| **Tests** | **474** — 136 pytest (18 files) + 338 Vitest (27 files) |
| **Test:app ratio** | ~1,990 lines of test code against ~2,070 lines of application code |
| **Migrations** | 12 Alembic revisions |
| **Frontend deps** | 5 runtime dependencies, no UI kit |

Verify the counts rather than trusting them: `grep -rn "^@router\.\|^@app\." app/` returns 21, `pytest -q` reports 136, and `npm test` in `frontend/` reports 338.

---

## What it does

A recipe here is attributed to a **person** — the dish is the title, the person is the byline ("from Lola") — and their imprecise measurements ("a dash," "three soup spoons," "until it smells right") are preserved verbatim rather than normalized away. The knowledge an ingredient list can't hold lives as a note on the individual step it belongs to.

- **Write a recipe** by typing or by dictating it (speech-to-text; see below).
- **Keep it private, or publish it** to a public Browse feed. Private is the default.
- **Pass it on** — mint a shareable link that opens the full recipe with no account.
- **Scale it** to a different serving count, without inventing precision that was never there.
- **Cook it** — a cooking-mode reading view, and a log of each time you cooked it.
- Cover photos, including automatic iPhone HEIC → JPEG conversion.

The UI is a warm, playful "kitchen": bold color-block stickers, chunky display type, food-forward illustration, mobile-first.

---

## Setup

Requires Python 3.11+ and Node 18+.

### Backend

```bash
git clone https://github.com/charman02/issei.git
cd issei
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` in the project root. Only the first two are required — see `app/config.py`:

```ini
DATABASE_URL=sqlite:///./recipes.db
JWT_SECRET=your-secret-here
# Optional. Photo upload returns an error without these.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
# Optional. Comma-separated extra CORS origins; localhost:5173 is always allowed.
CORS_ORIGINS=
```

```bash
alembic upgrade head
uvicorn app.main:app --reload        # http://localhost:8000/docs
```

### Frontend

Run alongside the backend — both servers must be up.

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Vite dev server **must** be on port 5173: it is hardcoded in the backend's default CORS origin list (`app/config.py`). If Vite picks another port because 5173 is taken, API calls will fail CORS.

### Tests

```bash
pytest -q                            # 136 backend tests
cd frontend && npm test              # 338 frontend tests
```

---

## Architecture

Layered: `routers → services → models`, with Pydantic schemas at the boundary.

```
app/
  main.py            FastAPI app, CORS, router registration, GET /health
  config.py          Pydantic Settings — env vars, CORS origin list
  auth.py            JWT creation/verification, get_current_user dependency
  database.py        SQLAlchemy engine, session, declarative Base
  models/            8 SQLAlchemy models
  schemas/           Pydantic request/response models
  routers/           auth · recipes · upload · feedback
  services/          scaling · folk_units · sharing · growth
frontend/src/
  pages/             one component per screen
  components/        shared UI
  lib/, utils/       quantity parsing, speech, formatting helpers
  api/               axios client + error normalization
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a file-by-file account.

### Data model

| Model | Purpose |
|---|---|
| `User` | Account: email, hashed password, first/last name |
| `Recipe` | The dish: name, story, origin attribution, visibility, `deleted_at` |
| `IngredientSection` | Optional named grouping ("For the marinade") |
| `Ingredient` | Name, quantity fields, `quantity_type`, position |
| `Step` | Ordered instruction, optional per-step note, optional photo |
| `Handoff` | A capability-token grant of one recipe to one person |
| `CookEvent` | One record per time a recipe was cooked |
| `Feedback` | In-app feedback note |

---

## Key engineering decisions

**Fuzzy quantity modeling.** Ingredients store `quantity_text` (always preserved verbatim) plus optional `quantity_value` and `unit`, with a `quantity_type` of `precise`, `imprecise`, or `unmeasured`. Asian home cooking rarely uses exact measurements — "a dash of fish sauce" and "3 soup spoons" are how these recipes are actually passed down — so storing only numbers would discard the thing the app exists to keep.

Classification is deliberately not just hedge-word detection ("about", "roughly", "~"). It also recognizes **folk, body, and vessel units** — "3 soup spoons", "a pinch", "a good splash", "two fingers of water" — because a clean number in front of a fuzzy vessel is still a fuzzy amount. Those split further at scale time (`app/services/folk_units.py`): a *countable* folk unit has a real count, so "3 soup spoons" doubled honestly is "6 soup spoons"; a *non-linear* one describes a geometry rather than a quantity, so "3 fingers of water" is kept verbatim and the cook is handed the multiplier instead of an invented number. Without this split, the app's own headline example would normalize into "7.5 soup spoons" — exactly the behavior it exists to refuse.

**Read authorization is one funnel; write authorization is a different rule.** `can_view` (`app/services/sharing.py`) is the single predicate every recipe read passes through: viewable if the recipe is public, **or** you own it, **or** you hold an accepted handoff on it. Editing and deleting are owner-only, enforced separately by a `user_id` filter in `patch_recipe`/`delete_recipe`. A grantee can read and cook a recipe they were handed; they can never change someone else's record of it. Keeping reads in one function is deliberate — a second, subtly different rule elsewhere is how private data leaks.

**The invite token is a capability.** `secrets.token_urlsafe(32)` is unguessable, and holding it *is* the permission to read, so `GET /recipes/invite/{token}` serves the whole recipe with no account at all. The recipient of a handoff has never tasted the dish and wants to cook it; gating the ingredients behind a signup form would be friction at the moment of highest intent. What stays out of reach is bounded by the response schema (`InvitePreview`), not by a signup wall: the owner's private `notes` and all account IDs are withheld. Signing up is what lets you *keep* a recipe, not what lets you read it.

**A second recipient used to revoke the first.** `claim_invite` originally set `to_user_id` on the handoff row to whoever claimed it. But `can_view` decides access by matching that same column, and a shareable link is one row handed to several people — so the second person to open a link overwrote the first person's claim, and the first person silently lost the recipe. No error, no notification.

The fix separates the link from the grant: claiming a row that already belongs to someone else mints the new user their own `Handoff` on the same recipe, and link-only handoffs stopped being deduped into one row (the same bug from the sending side). Two regression tests pin it — `test_second_claimer_does_not_revoke_the_first` asserts `can_view` is true for *both* claimers, and `test_reclaiming_is_idempotent_for_the_same_user` asserts re-opening a link doesn't pile up duplicate grants (`tests/test_invite_softwall.py`, fixed in `39e9934`). The generalizable lesson, and why it's written down: an access-control row keyed to "the current claimant" is a single-occupancy assumption hiding inside a feature that is explicitly about sharing.

**Single transaction with `db.flush()` for mid-transaction IDs.** Creating a recipe with nested ingredients and steps happens in one transaction — all inserts succeed or all roll back. Within it, `db.flush()` after the recipe and each section yields their auto-generated IDs without committing, so child rows can set `recipe_id`/`section_id` before the final commit.

**Soft delete.** Recipes set `deleted_at` rather than deleting the row; every query filters `deleted_at IS NULL`. Hard delete was simpler, but permanently losing a family recipe is the one failure this app cannot have. Recovery is clearing the timestamp.

**Deleting two features that fought the premise.** Both were built, shipped, and then removed on purpose.

A *consolidating shopping list* summed ingredients across recipes. Summing means normalizing amounts, which is exactly what this app refuses — on its most common data it produced `"a good splash + a glug"`, which is not a total, just two lines concatenated. Every real total also depended on the ingredient appearing in a hand-maintained density table that only grew when someone noticed a wrong number. And because no screen ever called it, a crash, several wrong totals, and an inverted unit conversion all lived in it undetected for its entire existence.

A *lineage tree* modeled recipes as a generational graph (`parent_recipe_id`, a ghost-ancestors table, root-bound visibility, a `/lineage` endpoint). The product is a bridge between two people — one dish, handed to one person — not a family network. Removing it collapsed authorization from "walk to the lineage root, then match grants against that root" down to a single statement about the recipe in front of you. The simplification was verified safe against production data first: zero recipes had a `parent_recipe_id`, so the tree walk was already the identity function on every real row and no authorization outcome could change. The one piece kept was `origin_attribution` — the "from Lola" byline — because attribution is a fact about one recipe, not an edge in a tree.

**Validation at the boundary; error copy in one place.** A person's name is load-bearing here, since every recipe carries a byline, so `UserCreate` strips whitespace and then requires one character — rejecting `""` and `"   "` with the same rule. Password length is capped at 72 bytes because that is bcrypt's own ceiling and anything longer is silently truncated. These rules live on the *input* model only: tightening `UserResponse` too would turn an already-stored blank name into a 500 on read, punishing an old account for a rule it predates. On the client, `toUserMessage` (`frontend/src/api/client.js`) is the single funnel turning any axios failure into a sentence — a FastAPI 422 arrives as an array of objects, and rendering it raw once put `[object Object]` in front of a user who had simply chosen a short password. It reports every failing field rather than the first, and distinguishes "no response at all" (offline) from "the server said no."

---

## Dictation, and what this app deliberately does not do

You can **dictate a recipe instead of typing it.** `frontend/src/lib/speech.js` is the only place that touches the Web Speech API; `DictateButton.jsx` renders it. 72 tests cover it (`speech.test.js`, `DictateButton.test.jsx`).

Two details worth naming. The recognizer constructor is read off `window` at *call* time, never at import time — jsdom implements no part of the Web Speech API, so a component reaching for `window.SpeechRecognition` itself would be untestable, and untestable is how a browser-API feature rots silently. Reading it late lets a test install a fake, remove it, and exercise both the supported and unsupported paths in one file. And because Firefox has no implementation at all, the button renders **nothing** rather than a disabled control: an affordance that can't do what it depicts is worse than a missing one.

**There is no audio anywhere in this product** — no recording, no storage, no playback, no transcription of stored audio. The browser's recognizer returns text and the utterance is discarded. `Step.voice_note` is a `Text` column typed by whoever wrote the recipe down, rendered under its step as "a note on this step."

That distinction is enforced, not just documented. Five tests assert the UI makes no claim the product can't back: four fail if any screen says "voice", "recording", "audio", or "listen" (`Home.test.jsx`, `Welcome.test.jsx`, `Login.test.jsx`, `InviteLanding.test.jsx`), and one fails if a removed design token returns (`frontend/tailwind.config.test.js`). Recording a person explaining a step in their own voice would be the strongest version of this app's premise, and it is genuinely not built — it needs browser capture, storage and transcoding, playback, transcription for search and accessibility, and a much larger privacy surface. It must not be described as shipped or partially shipped.

---

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Liveness check. Returns `{"status": "ok"}`. |
| POST | `/auth/signup` | No | Creates an account. Returns id, email, created_at. |
| POST | `/auth/login` | No | Verifies credentials, returns a JWT access token. |
| GET | `/auth/me` | Yes | The currently authenticated user. |
| POST | `/recipes` | Yes | Creates and returns a recipe. |
| GET | `/recipes` | Yes | The current user's recipes. |
| GET | `/recipes/{id}` | Yes | One recipe, subject to `can_view`. |
| GET | `/recipes/{id}/scale?servings={n}` | Yes | The recipe scaled to a target serving count. |
| PATCH | `/recipes/{id}` | Yes | Modifies a recipe. **Owner only.** |
| DELETE | `/recipes/{id}` | Yes | Soft-deletes a recipe. **Owner only.** |
| POST | `/recipes/{id}/cook` | Yes | Logs a cook event; returns the updated `cook_count`. |
| POST | `/recipes/{id}/handoff` | Yes | Passes the recipe on (owner only). A recipient is **optional**: with a user or email the grant is addressed to them; with neither it is link-only, minting a shareable token. On a private recipe the grant confers access — view and cook, never edit. |
| GET | `/recipes/shared` | Yes | Recipes shared *with* the caller (accepted grants, excluding their own). |
| POST | `/recipes/handoffs/{id}/accept` | Yes | Claims a pending invite by handoff id. Backend-only; the two auto-accept paths cover the in-app cases, so there is no UI for it. |
| GET | `/recipes/invite/{token}` | **No** | Unauthenticated read of a handed-off recipe — the **full** recipe (ingredients, steps, per-step notes, story, servings, description). The owner's private `notes` and account ids are withheld. |
| POST | `/recipes/invite/{token}/claim` | Yes | Claims an invite by token, granting the caller access. Resolves the mismatched-email case; idempotent per user. |
| GET | `/recipes/browse` | **No** | Public discovery feed: every non-deleted recipe whose visibility is `public`, newest first. Per-owner activity (`owner_cook_count`, `last_cooked_at`, `shared_with_count`) is zeroed, since the endpoint is unauthenticated. |
| GET | `/recipes/ingredient-suggestions` | Yes | The caller's own ingredient vocabulary, for autosuggest. |
| POST | `/upload/recipe-photo` | Yes | Uploads a photo to Cloudinary (recipe cover or a step). |
| POST | `/feedback` | Yes | Files a feedback note from inside the app. |
| GET | `/feedback` | Yes | Returns **only the caller's own** notes. |

*21 routes as committed — the table is the whole surface. This count has changed as features were removed, so verify rather than trust it: `grep -rn "^@router\.\|^@app\." app/` returns 21 (20 router decorators + `GET /health`, declared on the app itself in `app/main.py`).*

**Three visibility tiers — private → shared → public.** "Shared" is not a stored enum value: `visibility` stays `private | public`, and a private recipe with at least one accepted grant *is* shared with those people. In-app grants are accepted instantly; email invites stay pending until the invitee signs up with the matching address, at which point they auto-accept.

---

## Testing

```bash
pytest -q                      # 136 tests, 18 files
cd frontend && npm test        # 338 tests, 27 files
```

**Backend (136).** Concentrated where a bug would be either silent or costly: the scaling service and its folk-unit vocabulary (20), feedback (16), sharing and grants (13), signup validation (13), growth fields (12), the invite-token flow (11), visibility (8), ingredient suggestions (8), step photos (7), plus migration and harness checks.

**Frontend (338).** Quantity parsing and imprecise-measure labelling, the handoff and invite flows, form and page components, dictation (72), and design-token invariants.

**What is not covered.** There are no end-to-end browser tests — the frontend tests mock the API rather than driving a real backend, so a contract drift between the two would not be caught by either suite. There is no CI pipeline; tests run locally and before deploys. Load and concurrency behavior is untested.

---

## Deployment

The frontend is a static SPA build on **Vercel**; the backend runs on **Render**; the database is **Neon** Postgres. Both auto-deploy on push to `main`. The frontend reaches the backend through a build-time `VITE_API_URL`, and the backend's allowed CORS origins are env-driven, so either host can move without a code change. SQLite is used locally, Postgres in production.

---

## Limitations

- **Free tiers.** The API cold-starts in roughly a minute after idling.
- **Single-user recipes.** There is no families model, so a recipe one relative adds isn't automatically visible to the rest of a family — handoffs are the current substitute. This is the largest gap relative to the product's purpose.
- **No ingredient canonicalization.** "garlic cloves", "minced garlic", and "garlic" are unrelated strings, which blocks ingredient search and any cook-from-what-I-have feature.
- **No email transport.** Email invites work only through the auto-accept-on-signup path; nothing is actually sent. Delivery is the share link.
- **No E2E tests, no CI** (see Testing).
- **`VisibilityControl.jsx` still reads two fields that no longer exist** on the API response (`parent_recipe_id`, `child_count`), leftover from lineage. The guards resolve to the correct path, so it's dead code rather than a bug.

See [FUTURE.md](FUTURE.md) for the roadmap: multi-user family sharing, an iOS app, translation, richer per-step media, and ingredient canonicalization.

## Documentation

| File | Contents |
|---|---|
| [POSITIONING.md](POSITIONING.md) | What the product is, who it's for, and the list of claims that are **not** true and must not be made |
| [ARCHITECTURE.md](ARCHITECTURE.md) | File-by-file walkthrough of backend and frontend |
| [FUTURE.md](FUTURE.md) | Roadmap, plus why the removed features were removed |
