---
name: issei-live-verify
description: Use before claiming any user-facing or external-API change to issei is done, fixed, or working — and before any push or deploy. Runs the app for real, exercises the change in a browser, and for anything that calls a model or the network measures real latency and the failure paths. Every check here traces to a bug that shipped because tests passed but the running system was never looked at.
---

# issei live-verify

The gate between "the tests pass" and "it works." It exists because issei's real defects
were **invisible in a diff and invisible to the unit suite** — they only appeared when the
app ran:

- a model call took **72.9s against a 25s client timeout**, so the feature silently fell
  back every time (`app/services/recipe_ai.py`) — caught only by timing a real call
- a unit tapped from the chip strip was **dropped and the row committed early**, saving a
  bare number typed `precise` — 17 passing tests missed it because they all *typed*
- dictation **concatenated utterances into one line**, defeating the parser
- a no-photo cover set an amount as type a real user read as "ingredients on the photo"
- a hero card was **cut off at the top**

None of these fail a test. All of them are obvious the moment a human looks at the running
app. So: **before saying a user-facing or external-API change is done, run it and look.**

**Core principle:** evidence before assertion. "Verified" is a claim about something that
already happened — a command that ran, a screen you saw, a latency you measured. If it
hasn't happened yet, the honest word is "not yet verified," and it goes in the checkpoint
(see `issei-checkpoint`).

## Getting the app running (the traps, in order)

1. **Node isn't on the default PATH.** Export it first, or every `npm`/`npx` fails:
   `export PATH="$PATH:/c/Program Files/nodejs"`
2. **Vite MUST be on port 5173.** `app/config.py`'s CORS allowlist contains only
   `http://localhost:5173` — a wrong port fails silently, and that failure has twice been
   misdiagnosed as a real bug. If Vite grabbed another port, kill it and restart on 5173.
   `--strictPort` is your friend.
3. **API on 8000.** Backend, from the repo root, with a throwaway SQLite DB so prod is never
   touched:
   `DATABASE_URL="sqlite:///./tmp-verify.db" JWT_SECRET=x <venv-python> -m uvicorn app.main:app --port 8000`
   (the default `python` on PATH is an unrelated venv with no deps — use the interpreter that
   has them; `python -m pytest --version` tells you if you've got the wrong one.)
4. **Killing a stale server on Windows:** `taskkill //F //PID <pid>`, never `pkill`. Find the
   pid with `netstat -ano | grep LISTENING | grep :5173` (or `:8000`).

## Exercise the change in a browser

Drive it the way a person would, headless, and LOOK at the screenshot — don't just assert
DOM text. There is a seeded account for this: `torn1394@t.com` / `pw123456`, which has
recipes with and without photos, folk amounts, and step notes. Playwright's Chromium is
installed. Reproduce the actual user action (tap the chip, paste the run-on sentence, open
the photo-less recipe), then confirm the result on screen, not just in state.

## For anything that calls a model or the network (this is where the silent failures live)

1. **Measure the real round-trip against the timeout.** The parse call has a 25s client
   timeout; a cold Render start alone was ~16s. Time an actual call and confirm it lands
   under the limit with headroom — a warm test says nothing about a cold one.
2. **Exercise the no-key path.** With `OPENROUTER_API_KEY` unset, the endpoint must return
   `ai: false` (not a 500) and the client must fall back to the local parser. This is the
   difference between a feature and a dependency; verify it, don't assume it.
3. **Exercise the error path.** A rejected/garbage response must degrade to the fallback with
   no error surface shown to the user.
4. **Confirm the fidelity guarantee end-to-end** for any recipe-capture path: a folk amount
   goes in and comes back **verbatim** ("a good splash" stays "a good splash", "about a kilo"
   stays "about a kilo"), and no ingredient the user didn't name appears. This is the whole
   product; a model that "helpfully" normalizes is worse than no feature.

## Then state what still needs the user

Some things a headless run can't judge — how a screen *reads* to a person, whether copy
lands. Say plainly what you verified and what still needs their eyes. Never round "the tests
pass and it built" up to "it works."

## Before a push/deploy

Run both suites (`<venv-python> -m pytest -q` and `cd frontend && npx vitest run`) and the
production build (`npx vite build`), then — for prod — verify against the LIVE URL after the
deploy lands, not just locally: the frontend is Vercel (`issei-delta.vercel.app`), the API
is Render (`family-recipe-library.onrender.com`), and Render's free tier cold-starts, so the
first request after idle is slow. Confirm the new surface actually responds in prod.
