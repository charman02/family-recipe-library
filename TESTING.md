# Testing

How issei is tested, and the invariants that must never regress. If you're
delegating a change and want one file to point someone at, this is it.

## How much ships without asking (autonomy level B)

The agreed working level. Within the guardrails below, **low-risk work ships without
a per-change approval:** bug fixes, doc updates, and changes already covered by
tests — once both suites are green (locally + CI) and the pre-ship review passes.

**Always stop for explicit approval** when a change touches any of:
- the **data model** (a new/changed model, column, or migration),
- **positioning** (anything in POSITIONING.md's territory, or a claim about what the
  app is/does),
- a **new user-facing feature** (not a fix to an existing one).

Merging to `main` still deploys to prod, so the review + green-CI precondition is not
optional — level B changes *who confirms the routine cases* (the process, not a
per-change ask), not *whether the gates run*. When in doubt about which bucket a
change falls in, treat it as "stop and ask."

## The process (three gates)

1. **The suites, run locally, on every change.**
   - Backend: `pytest` (from repo root). Hermetic — each test builds its own
     in-memory SQLite DB (`tests/fixtures.py`), so it needs no `.env` and touches
     no real database.
   - Frontend: `npm test` (= `vitest run`) and `npm run build`, from `frontend/`.
   - Both are fast (~30s each). Run them; don't quote remembered counts.
   - *Local gotcha:* one backend test (`test_health_ready_proves_db_reachable`)
     does a real `SELECT 1` against whatever `DATABASE_URL` your `.env` points at.
     On a dev machine pointed at Neon it fails (no network egress) — that's
     environmental, not a regression. It passes in CI (which uses `sqlite://`).

2. **CI — the automated gate (this is what makes delegation safe).**
   - `.github/workflows/test.yml` runs both suites on every **pull request**.
   - `.github/workflows/deploy.yml` runs the same two jobs on a push to `main` and
     the `deploy` job **`needs:` them** — so **a red suite blocks the prod deploy
     before any image is built or migration runs.** Tests are no longer a thing
     someone has to remember; the pipeline enforces them.
   - (Docs-only pushes — `**.md`, `docs/**` — skip deploy entirely, by design.)

3. **The pre-ship review agents (judgment, not just green).**
   - `issei-ship-review` → the `issei-branch-reviewer` agent: an adversarial,
     read-only review of the whole diff before a `main` merge. This is what catches
     the bugs tests don't have yet (it caught a silent edit-erasure bug that all
     501 green tests missed).
   - `issei-docs-check` → the `issei-docs-auditor` agent: re-measures every count in
     the docs and scans for POSITIONING violations.
   - Run **both** before merging to `main`. Green suites are necessary, not
     sufficient — the reviewer is where correctness-in-context is checked.

## Must-pass invariants

These must have a passing test **no matter what a change is for.** If a change
would break one of these, the change is wrong — not the test. If you add a feature
that touches one of these areas, extend its test; never delete the guard to go green.

Each is a real, named test today (verify with the command; don't trust this list
alone — re-run it):

1. **Read authorization: a private recipe is invisible to non-owners.**
   `can_view` is the single rule (owner OR `public` OR (`friends` AND an accepted friend via `are_friends`) OR an accepted handoff grant — the `friends` branch arrived with #68). A stranger
   gets 404 on the recipe, its scale, its cook, and it never appears in `/browse`.
   → `tests/test_sharing.py`, `tests/test_visibility.py`

2. **Read is not write: a recipient can never edit or delete.**
   `patch_recipe` / `delete_recipe` / `handoff_recipe` filter on `user_id`. A
   grantee can read and cook, never mutate someone else's record.
   → `tests/test_sharing.py`, `tests/test_sharing_api.py`

3. **Autosuggest never leaks another user's data.**
   `ingredient-suggestions` and `field-suggestions` are scoped to the caller's own
   non-deleted recipes — a value from someone else's kitchen must not surface.
   → `tests/test_ingredient_suggestions.py`, `tests/test_field_suggestions.py`

4. **Imprecise amounts are preserved verbatim, never normalized.**
   "a dash", "3 soup spoons" survive save, scale, and display unchanged; scaling
   branches on `quantity_type` and refuses to invent precision.
   → `tests/test_scaling.py`, `frontend/src/components/RecipeForm.test.jsx`

5. **No false audio/recording claims in the UI (POSITIONING).**
   The words `voice` / `recording` / `audio` / `listen` / `in their own words`
   appear nowhere a user or screen reader can reach. Dictation is speak-to-type;
   the utterance is discarded. Guard tests assert the banned set across the mic UI.
   → `frontend/src/components/DictateButton.test.jsx`,
     `frontend/src/components/PasteRecipe.test.jsx`, `RecipeForm.test.jsx`

6. **No lineage / family tree.**
   No ancestors, descendants, roots, branches, or parent_recipe_id. Removed
   deliberately; must not creep back (the docs-auditor also scans for this).
   → covered by the POSITIONING scan + absence of the models/columns

7. **Edit round-trips every field — nothing silently erased on save.**
   The form sends its scalars unconditionally, so `EditRecipe` must seed every one
   back from the fetched recipe. A field not seeded is nulled on the next edit —
   this is a real bug we shipped-then-caught (diet/prep_time). Any new scalar on the
   form gets a seed in `EditRecipe.initialValues` AND a round-trip assertion.
   → `frontend/src/components/RecipeForm.test.jsx` ("carries ... through an edit
     round-trip")

## When you add a feature

- **New endpoint** → a test file that pins its auth (401 for anonymous where
  required) and, if it reads user data, its **scope** (invariant 1/3).
- **New recipe-form field** → seed it in `EditRecipe.initialValues` and add a
  round-trip assertion (invariant 7). Add it to the payload test.
- **New user-facing copy near dictation/handoff** → it's covered by the banned-word
  guards, but if you add a new screen with a mic, add the guard there too.
- **New model/migration** → `tests/test_migrations.py` must still replay clean on
  SQLite (migrations are portable, not Postgres-only).

## Coverage gaps (known, not yet closed)

Backend routers are well covered. These frontend surfaces have **no test file** and
are the first places a silent break can hide — add tests when you next touch them:
`EditRecipe`, `HandoffPage`, `ForgotPassword`, `ResetPassword`. (`Browse` has a test file now.)
(`EditRecipe` being untested is exactly how invariant 7's bug reached prod.)
