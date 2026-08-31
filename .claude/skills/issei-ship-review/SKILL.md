---
name: issei-ship-review
description: Use before merging/deploying issei to main — the final code-review gate over ALL new changes on the ship branch, run every time alongside the docs check. Dispatches a whole-branch reviewer over the full diff vs main, surfaces its findings ranked by severity, and holds the ship on any Critical/Important finding until the user decides. Merging to main auto-deploys to prod, so this is the last gate before real users.
---

# issei ship review

The final code-review pass before anything reaches `main`. `main` auto-deploys to prod
(Vercel + Render + Neon), so this is the last gate before real users see the change. It is
a standing rule, the same shape as the docs check: **every ship gets a full-branch review,
every time — not just the batches that feel risky.**

**Core principle:** review the whole branch as the single body of work a deploy ships, not
commit-by-commit. Bugs hide in the seams between commits (a helper changed in commit 2, a
caller added in commit 4); only the merged diff vs `main` shows them. The reviewer is
read-only and adversarial — it surfaces, it does not fix. The user decides what to do with
each finding; nothing auto-resolves.

## When this runs

- **Before any merge/fast-forward to `main`, and before any prod deploy.** This is the
  trigger. If a merge to main is imminent and this hasn't run, run it first.
- On demand ("review the branch", "is this safe to ship?", "final pass before deploy").
- It runs ALONGSIDE `issei-docs-check`, not instead of it: docs-check keeps the README true,
  this keeps the code correct. Ship only when BOTH are clean (or their findings are
  explicitly accepted by the user).

This is distinct from `issei-reviewer`, which reviews ONE task against a brief mid-build.
This one has no brief — it judges the finished branch on its merits before it goes live.

## How to run it

1. **Establish the exact scope first.** Determine the base (`origin/main`) and the ship
   branch, the commit list, and — critically — which changed paths are **parked/excluded**
   (uncommitted or intentionally-not-shipping work, e.g. the AWS migration files). The
   reviewer must review what will actually merge, nothing more. Produce the diff with
   `git diff origin/main...<branch>` (three-dot: the branch's changes since it diverged).

2. **Dispatch the `issei-branch-reviewer` subagent** (`.claude/agents/issei-branch-reviewer.md`,
   promoted to `~/.claude/agents/`). Give it the base ref, the branch, the diff (or the exact
   command to produce it) + commit list, and the explicit list of parked/excluded paths. It
   returns a ship/hold verdict plus findings ranked Critical / Important / Minor.

3. **Read the report and act on severity — do not auto-apply anything:**
   - **Critical** (correctness, security, data loss, a false product claim per POSITIONING) —
     HOLD the ship. Surface to the user; fix before merging.
   - **Important** — surface to the user; fix before ship OR get an explicit "accept and ship
     anyway". Don't decide that on their behalf.
   - **Minor** — list them; the user chooses fix-now or file-for-later.
   Fixes are normal edits (with their own tests), reviewed the same way; the reviewer never
   edits the tree itself.

4. **Never soften a finding to make the ship pass.** If the reviewer flags a real defect, the
   code is wrong, not the reviewer. And never pre-judge a finding as a false positive on the
   user's behalf — surface it and let them adjudicate.

5. **Re-review after fixes** if a Critical/Important fix changed non-trivial code — the fix
   itself can introduce a defect. A ship review that ends with unreviewed fix commits isn't done.

## Ship checklist (both gates, every time)

Before merging to `main`:
- [ ] `issei-ship-review` (this) — verdict SHIP, or findings explicitly accepted by the user
- [ ] `issei-docs-check` — README/docs measured true, POSITIONING scan clean
- [ ] both test suites green + prod build clean (`issei-live-verify` covers running-app checks)
- [ ] the user has given explicit go-ahead for the merge/deploy (main → prod is never automatic)

## What good looks like

A one-line SHIP verdict, a findings list that's either empty or fully triaged with the user,
and a clear statement of what was in scope vs parked — so the person approving the deploy
knows exactly what the review did and didn't cover.
