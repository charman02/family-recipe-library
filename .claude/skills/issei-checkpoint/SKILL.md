---
name: issei-checkpoint
description: Use after finishing any commit-sized unit of work on issei, and whenever the user asks "where are we", "recap", "status", "pause", or "resume". Surfaces a short, honest checkpoint so the user never has to reconstruct what changed — the direct answer to "the agent moves faster than I'm thinking, so I lose track."
---

# issei checkpoint

A five-line status, surfaced at the boundary of each unit of work rather than saved up for
the end of a session. It exists because of one measured pattern: work on issei has landed in
end-of-session batches (seven commits inside a two-minute window once), so the user approves
once and receives a pile of finished decisions with no chance to steer between them. The
commit bodies are already thorough — they just all arrive at the same moment. This skill
moves that visibility to where the user can still act on it.

**Core principle:** a checkpoint is for the person who wasn't watching. It reports what
*happened* and what needs *them*, not a plan or a pitch. If it takes more than ~10 lines,
it's a report, not a checkpoint — cut it.

## When to surface one

- **After each commit-sized unit lands** — not batched to session end. One unit → one
  checkpoint → the next decision. This is the point of the skill; a perfect recap delivered
  only at the end has already failed.
- On **"where are we" / "recap" / "status" / "catch me up"** — the retroactive ask this
  pre-empts.
- On **"pause" / "stop for now"** and at the **start of a resumed session** — so picking
  back up costs nothing.
- Before a **push or deploy** — paired with whatever verification the change needs.

## What it contains (max ~10 lines)

1. **Committed this session** — one line per commit: short sha + the one-line subject. Not
   the essay; the reader can `git show` if they want it.
2. **Uncommitted** — what's changed on disk but not committed, in a phrase.
3. **NOT yet verified in a real browser / against the real API** — the single most important
   line, because issei's actual bugs (latency past a timeout, a unit dropped through one
   door, a cover misread by a real person) were invisible in code and only showed up when
   run. Name what still needs the user's eyes or a live check. If everything was verified,
   say so plainly.
4. **The one decision that needs the user** — the next fork only they can call (a deploy, a
   positioning wording, a scope question). One item, not a menu.
5. **Where the work lives** — branch and worktree, so a resumed session or a second machine
   knows where to look. (Currently: branch `redesign-kamala`, worktree `craft-d`. Verify
   with `git branch --show-current` rather than trusting this line.)

## What it is NOT

- Not a plan for future work (that's a different artifact).
- Not a re-summary of a commit body that already exists — link by sha, don't restate.
- Not a place to claim something works. "Verified" belongs only after the check ran; if it
  didn't run, line 3 says so. Evidence before assertion.

## Shape

```
Checkpoint — <branch> @ <worktree>
Committed: <sha> <subject> · <sha> <subject> …
Uncommitted: <phrase, or "clean">
Not yet verified live: <what still needs eyes / a running check, or "all verified: <how>">
Needs you: <the one decision>
```

Keep it terse. The value is that it's short enough to actually read between units.
