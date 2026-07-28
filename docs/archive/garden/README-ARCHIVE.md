# Archived garden-era docs

These are the **original documentation files from before the "kitchen" redesign**,
when Issei's UI was built around the seed→tree "living plant" / garden metaphor
(each recipe grew from a seed into a tree; the Kitchen was a garden of
recipe-plants grouped into growth bands).

That garden UI was removed and replaced by the "Kamala's Recipes" sticker /
color-block kitchen design. The docs in the repo root (`README.md`,
`ARCHITECTURE.md`, `FUTURE.md`, `CLAUDE.md`) were rewritten to match. These
copies are kept verbatim so the garden framing is never lost.

**Snapshot point:** taken from the committed `main` docs (identical to the
`garden-v1` tag) at the time of the docs rewrite. `CLAUDE.md` is git-ignored, so
its garden version existed only on disk — this archived copy is its only
preserved snapshot.

**To see the full garden app** (not just docs), check out the tag:

```
git checkout garden-v1      # the seed→tree living-plant UI
git checkout kitchen-v1     # the current sticker kitchen redesign
```

or use the `./switch garden` / `./switch kitchen` helper script at the repo root.

Files here:
- `README.md` — garden-era project README
- `ARCHITECTURE.md` — garden-era architecture (lists Plant/GardenBed/Provenance/
  Wordmark components, growth libs, the garden Kitchen + living-recipe pages)
- `FUTURE.md` — garden-era roadmap
- `CLAUDE.md` — garden-era Claude Code project instructions (git-ignored in root)
