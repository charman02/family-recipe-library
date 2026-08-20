# TECHDEBT.md

A living map of **what to understand, learn, and revisit** — not only classic tech
debt, but concepts used, decisions made fast, and shortcuts with a tradeoff attached.
For a non-SWE owner scaling issei (and a multi-user social feature) with AI-directed
development.

**How this file is organized:** bucketed by **urgency** first, then **by area** inside
each bucket, so you can see *where your knowledge gaps cluster*. Each entry says what it
is, why it's flagged, and where it lives.

> Rebuilt from scratch 2026-08-20 by a fresh pass over the current code (the previous
> ledger was stale). Add to it continuously; move entries between buckets as urgency
> shifts rather than leaving them stale.

> **Stack note / drift caught:** the backend runs on **AWS ECS Fargate** (migrated off
> Render, task #37), frontend on **Vercel**, DB on **Neon Postgres**. Any doc/notes still
> saying "Render" are stale.

---

## Understand before scaling further

These are the things most likely to bite when real multi-user traffic and real
strangers arrive. Security/privacy first.

### Auth & permissions

- **Authorization is application-level, not query-level — the single most important
  thing to understand.** Read endpoints fetch the row by id, THEN call `can_view` /
  `can_view_post` in Python and 404 if false. The database query does *not* filter by who
  may see it. So the only thing protecting a private recipe is that a human remembered to
  write `if not can_view(...): raise 404` after the fetch. A future endpoint that fetches
  and returns a row **without** calling the rule leaks private content, and no DB
  constraint or test would catch it. *Why flagged:* this is the structural foundation of
  all privacy in the app, and it's the easiest thing to accidentally bypass. *Where:*
  `app/services/sharing.py` (`can_view`, `can_view_post`, `_resource_is_visible`);
  enforcement points in `app/routers/recipes.py` (`get_recipe`, `cook_recipe`,
  `get_scaled_recipe`) and `app/routers/posts.py` (`get_post`, `feed`, `user_posts`).

- **The invite link is a bearer credential — no expiry, no revoke.** `GET
  /recipes/invite/{token}` returns the whole recipe to anyone holding the link, no account
  needed (token = `secrets.token_urlsafe(32)`, unguessable). But whoever gets the link —
  forwarded, screenshotted, indexed — can read it, and there is no "disable this link"
  control. The only cut-off is deleting the recipe. *Why flagged:* it's central and
  intentional, but you must internalize that sharing a link = handing out a permanent
  read key. *Where:* `app/routers/recipes.py` (`preview_invite`, `claim_invite`).

- **Handoff grants are permanent and orthogonal to visibility.** Once someone claims your
  invite (or you hand them a recipe), they can read it *forever* — setting the recipe to
  "private" later does NOT revoke grants already given. "Make it private" only blocks
  people who never held a link. *Why flagged:* "private" doesn't mean what a user might
  assume; this is the #1 privacy surprise. *Where:* `app/services/sharing.py` (`can_view`
  handoff branch); `app/routers/recipes.py` (`claim_invite`).

- **Signup doesn't verify email ownership — and that feeds the invite flow.** Anyone who
  registers `victim@example.com` instantly inherits any recipe email-invited to that
  address (signup auto-accepts pending email handoffs). *Why flagged:* an account-takeover
  / data-inheritance path that matters more as you add users. *Where:* `app/routers/auth.py`
  (`signup` auto-accept block; `handoff_recipe` with `to_email`).

- **The `is_friend` / `is_grantee` precompute trusts the caller.** To avoid re-querying
  friendship per item on a profile/feed page, callers can pass a precomputed boolean that
  the rule uses *blindly*. A future caller that builds its "friends" set wrong (or passes
  `True` by mistake) silently makes a friends-only item visible to that viewer. *Why
  flagged:* it's a performance optimization that can become a leak if used carelessly.
  *Where:* `app/services/sharing.py`; callers in `app/routers/posts.py`, `friends.py`.

- **Browse is unauthenticated and filters in memory.** It loads *all* non-deleted recipes
  then drops non-public ones with one Python line. Mis-edit that line → every private
  recipe streams to anonymous callers; also it reads the whole table per call (a
  scaling/DoS surface). A query-level `WHERE visibility='public'` would be safer *and*
  faster. *Why flagged:* both a privacy single-point-of-failure and a scaling wall.
  *Where:* `app/routers/recipes.py` (`browse_recipes`).

- **JWT has no revocation, and login isn't rate-limited.** Tokens are valid until they
  expire no matter what; changing/resetting a password does NOT log out existing sessions,
  and nothing throttles password guessing. *Why flagged:* standard for v1, but real gaps
  to close before scale — "I was hacked, I changed my password" won't evict an attacker.
  *Where:* `app/auth.py` (`create_access_token`, `get_current_user`); `app/routers/auth.py`
  (login, `update_me`, `reset_password`).

### Data model

- **Deleting a user is a wide, untested cascade.** There's no account-delete path shipped
  yet, but the FK cascades are already defined: deleting a user removes their recipes — and
  a recipe cascade-deletes its ingredients/steps/cook-events/handoffs. Concretely, **a
  grantee's "shared with me" recipe disappears if the original sender deletes their
  account.** *Why flagged:* a real product decision hiding in a cascade rule; test it
  before shipping "delete my account." *Where:* `app/models/*.py` FK `ondelete` clauses
  (esp. `recipe.py`, `handoff.py`, `post.py`, `friendship.py`).

- **Visibility is three unconstrained string columns, and `profile_visibility` never
  gates reads.** `recipe.visibility`, `post.visibility`, `user.profile_visibility` are bare
  strings — no enum/CHECK — so a typo silently misbehaves. And `profile_visibility` does
  NOT decide who can read anything; it only picks the create-form default and drives the
  bulk sweep. *Why flagged:* the "I made my profile private, why can people still see my
  public recipe?" report is *working as designed* — you'll hear it; also add a DB-level
  CHECK/enum before users depend on it. *Where:* `app/models/{recipe,post,user}.py`;
  the rule in `app/services/sharing.py`.

- **Missing indexes on the two hottest multi-user paths.** The posts feed queries
  `user_id IN (...) ORDER BY id DESC` but there's no composite `(user_id, id)` index; the
  friend lookup filters `state='accepted' AND (requester_id=x OR addressee_id=x)` with no
  index on `state`. Fine at small scale, a filter-then-sort as tables grow. *Why flagged:*
  cheap to add now, painful to diagnose as latency later; the feed runs the friend lookup
  on *every* load. *Where:* `app/models/post.py`, `app/models/friendship.py`; queries in
  `app/routers/posts.py` (`feed`), `app/services/friends.py`.

### Infra & deployment

- **Production runs a single container (`desiredCount: 1`), no autoscaling.** One ECS
  Fargate task = one point of failure and a hard traffic ceiling; the intended scaling
  story is "raise the task count," but nothing does it automatically. *Why flagged:* the
  first knob to turn when traffic grows — and it needs a load test first (open task #38).
  *Where:* `infra/lib/issei-stack.ts` (service `desiredCount`); `Dockerfile` scaling note.

---

## Should learn soon

Important to how the app works and where quality/correctness can quietly slip, but not an
imminent scaling risk.

### Auth & permissions

- **Unfriending IS retroactive for friend-gated data (good) — but not for handoffs.**
  Removing a friend hard-deletes the friendship row, and because `are_friends` is checked
  live on every read, friends-only recipes/posts immediately stop being visible. But a
  recipe you *handed* that person survives the unfriend (see the handoff-grant note above).
  *Why flagged:* worth understanding the split — "unfriend" and "revoke what I shared" are
  two different actions and only the first exists. *Where:* `app/routers/friends.py`
  (`remove_friend`); `app/services/friends.py` (`are_friends`).

### Data model

- **Soft-delete (recipes) vs hard-delete (everything else) — "delete" means "tombstone."**
  Deleting a recipe only sets `deleted_at`; the text and photo URLs persist in the row
  forever, and every read query must remember to filter `deleted_at IS NULL` (an unenforced
  convention). *Why flagged:* a real retention/privacy question — a future "delete my data"
  request isn't actually satisfied by this; there's no purge job. *Where:*
  `app/models/recipe.py` (`deleted_at`); the filter convention across `app/routers/recipes.py`.

- **The ingredient denormalization — clever, but an app-level invariant.** Every ingredient
  stores both `section_id` (its group) *and* `recipe_id` (its recipe) directly, so "all
  ingredients for this recipe" is one flat query. Nothing in the DB enforces that an
  ingredient's section belongs to the same recipe — the app must keep them consistent.
  *Why flagged:* a deliberate design worth understanding (and not breaking) before you touch
  recipe editing. *Where:* `app/models/ingredient.py`, `app/models/ingredient_section.py`,
  `app/models/recipe.py` (the filtered `ingredients` relationship).

- **Friendship pair-normalization — `set_pair()` must run on every insert.** One row per
  unordered pair is guaranteed by a unique constraint on `(pair_low, pair_high)` = sorted
  ids, which stops a race from creating two rows for one pair. But those columns are only
  filled by remembering to call `set_pair()`; a future insert path that forgets it defeats
  the guarantee silently. *Why flagged:* a genuinely thoughtful concurrency design with a
  fragile dependency. *Where:* `app/models/friendship.py` (`set_pair`, the unique constraint).

### LLM layer

- **LLM cost & latency are per-call and user-facing, with no cap.** Each `/recipes/parse`
  spends money and the user waits (up to 45s client / 25s server timeout); there's no
  caching or rate-limiting beyond requiring login. A burst of parses = a burst of spend with
  no ceiling in code. *Why flagged:* a cost/abuse surface to watch as usage grows. *Where:*
  `app/services/recipe_ai.py` (`extract_recipe`); `frontend/src/api/client.js` (timeout).

- **LLM failures are invisible — silent fallback to a weaker parser.** When the model is
  down/unconfigured, the endpoint returns `ai: false` and the frontend silently uses the
  local line-based parser (which can't split run-on speech). Users never know they got the
  weaker path; it's logged only at `warning`. *Concept to learn:* **graceful degradation.*
  *Why flagged:* you won't notice quality regressions without watching logs/metrics.
  *Where:* `app/services/recipe_ai.py`; `frontend/src/components/PasteRecipe.jsx` (fallback);
  `frontend/src/lib/parseRecipeText.js` (the local parser).

- **Patterns worth the terms:** *strict JSON-schema extraction* (the model must fill an
  exact schema, `"strict": true`, not "please return JSON") and *verify-don't-trust* (the
  app re-classifies every amount and drops ingredients whose head word isn't in the source,
  so the model can't invent or normalize). *Where:* `app/services/recipe_ai.py`
  (`RESPONSE_SCHEMA`, `SYSTEM_PROMPT`, `_clean`).

### Quantity / scaling model

- **The folk-unit vocabulary lives in TWO files that must be edited together.** The list
  that decides how an amount scales (`app/services/folk_units.py`, backend) and the list
  that classifies an amount at entry time (`frontend/src/utils/quantity.js`) are duplicated
  with no automated sync check. Add a unit to one but not the other and the two halves
  disagree mid-recipe — e.g. a unit the frontend tags "their way" but the backend then
  *silently multiplies*, putting a wrong number in someone's kitchen (the exact thing the
  product exists to prevent). *Why flagged:* highest-value gotcha in this subsystem; there's
  also a real latent mismatch today (the frontend knows more unicode fractions than the
  backend classifier). **When you touch folk units, edit both files.** *Where:*
  `app/services/folk_units.py` ↔ `frontend/src/utils/quantity.js`; a third parser
  (`frontend/src/lib/parseRecipeText.js`) also understands amounts.

- **The three-type quantity model is the product's core claim in code.** Every amount is
  `precise` (scales by math) / `imprecise` (a real count in words that must never be
  converted) / `unmeasured` (stays verbatim). Scaling branches on the *type*, not the text;
  non-linear folk units ("3 fingers of water") get a "×N" note for the cook instead of a
  changed number. *Why flagged:* worth understanding deeply because it IS the differentiator
  — normalizing "a good splash" would be worse than no feature. *Where:*
  `app/services/quantity.py` (`classify_amount`), `app/services/scaling.py` (`scale_ingredient`).

### Frontend / state

- **`issei_user` is a client-side cache of server state that only refreshes on login/edit.**
  The logged-in user object lives in `localStorage` and is read directly (e.g. to pick the
  create-form visibility default from `profile_visibility`). If that value changes anywhere
  other than this device's login/edit, the browser keeps using the stale value. *Concept:*
  *client-side cache of server state.* *Why flagged:* small blast radius today (only a
  default the user can override), but the pattern to watch — the clean fix is a `GET
  /auth/me` refresh on app load. *Where:* `frontend/src/pages/Profile.jsx`, `PlantRecipe.jsx`,
  `PostComposer.jsx` (reads); `Login.jsx`, `Profile.jsx` (the only writes).

- **One axios instance carries three cross-cutting behaviors.** All API calls route through
  `client.js`, which auto-attaches the JWT (request interceptor), redirects to `/login` on
  any 401 (response interceptor), and normalizes every error into one human sentence
  (`toUserMessage` — it exists because a FastAPI 422 is an array of objects that once
  rendered `[object Object]`). *Concepts:* *axios interceptors*, *centralized error
  normalization.* *Why flagged:* route all new API calls + error UI through these, don't
  reinvent them per-page. *Where:* `frontend/src/api/client.js`.

### Infra & deployment

- **CI is the deploy gate, and the pipeline is itself a safety design.** Push to `main`
  auto-deploys, but only after both test suites pass; then the image is built, asserted
  importable, **migrations run (gated — a failed migration stops before the image is pushed
  or the service touched)**, and finally deployed with rollback on failure. Auth to AWS is
  keyless OIDC (no stored AWS secret in GitHub). *Concepts:* *CI as deploy gate*,
  *migration-gated deploy*, *keyless OIDC federation.* *Why flagged:* this is your safety
  net — understanding its order tells you exactly where a bad deploy gets caught. *Where:*
  `.github/workflows/deploy.yml`, `test.yml`; `infra/lib/issei-stack.ts` (the OIDC role).

- **Readiness probe proves the DB is reachable; a circuit breaker rolls back.** The load
  balancer health-checks `/health/ready` (which does a real DB check), so a container that
  can't reach Neon fails the deploy and rolls back instead of going green over a dead
  database. *Concepts:* *readiness vs liveness probes*, *deploy circuit breaker.* *Where:*
  `infra/lib/issei-stack.ts`; `app/main.py` (`/health`, `/health/ready`).

---

## Nice to know, no rush

Real, but low-stakes — dead code, minor redundancy, and conventions that only matter in
narrow situations.

### Data model

- **`growth_stage` / `growth_vitality` / `soul_count` are computed on every recipe read but
  shown nowhere.** A whole scoring model (seed→tree) survives from the removed "garden" UI;
  it reads the recipe's story/photo/steps to produce numbers no screen renders. No schema
  footprint, but dead weight on the read path — a candidate to delete once you confirm
  nothing consumes the response field. *Where:* `app/services/growth.py`.

- **`effective_visibility` is a do-nothing pass-through.** It just returns `recipe.visibility`
  now; it used to resolve inherited visibility. Harmless, but a reader may assume it does
  real work. *Where:* `app/services/sharing.py`.

- **Redundant / unused indexes.** `ix_friendships_pair_low` duplicates the unique
  constraint's index, and *no query reads the pair columns at all* (they exist only to
  enforce uniqueness); `ix_posts_created_at` is unused because the feed keysets on `id`, not
  `created_at`. All pure write-cost with no read benefit — cheap to drop. *Where:*
  `alembic/versions/a7b8c9d0e1f2_add_friendships.py`, `b8c9d0e1f2a3_add_posts.py`.

- **Retention odds and ends.** Pending email invites store the invitee's email forever if
  they never sign up; consumed password-reset tokens are kept (not deleted); cook-events and
  friendships accumulate with no expiry. *Why flagged:* data-minimization items for a future
  privacy pass, not urgent. *Where:* `app/models/handoff.py`, `password_reset.py`,
  `cook_event.py`.

### Auth & permissions

- **Signup leaks account existence; forgot-password deliberately doesn't.** Signup returns
  "Email already registered" (confirms an account exists), while forgot-password always
  returns 204 to avoid enumeration. *Why flagged:* an inconsistency to know about if
  enumeration ever matters. *Where:* `app/routers/auth.py`.

### Infra & deployment

- **New migrations that ALTER an existing FK must repeat a specific pattern** (a
  `NAMING_CONVENTION` dict + `batch_alter_table`) or they break local SQLite replay while
  passing on prod Postgres — a silent dev/prod divergence. Only relevant when you write such
  a migration. *Where:* `alembic/versions/0894735d3ccd_*.py`, `bba3856b2139_*.py` (the pattern);
  fixed under task #31.

- **No one-click rollback.** `workflow_dispatch` redeploys HEAD; rolling back means reverting
  the commit. The CI gate runs against in-memory SQLite, so Postgres-specific issues can
  still reach prod (only the migration step touches the real DB). *Where:*
  `.github/workflows/deploy.yml`.
