# Future Roadmap

*Current state verified against the code on **2026-09-04**. Re-verify before trusting any
claim here; this file has drifted a full release cycle behind before.*

This document outlines planned features and improvements for Issei — a full-stack app for
sending one recipe from the person who cooks it to the person who just tasted it and asked for
it (*issei* = "first generation"). See `POSITIONING.md` for the positioning and the explicit
list of things the app does *not* do.

## What the current build actually is

Deployed and in beta use: FastAPI + SQLAlchemy on AWS ECS Fargate (`api.issei.app`), a React
+ Vite + Tailwind SPA on Vercel (`issei.app`), Postgres on Neon. **57 routes, 15 models, 432
backend tests, 671 frontend tests** — re-count rather than quote.

**The signature act.** A recipe is attributed to a **person** (the dish is the title, the
person is the byline "from Lola"), imprecise measurements are preserved verbatim rather than
normalized ("a dash", "3 soup spoons"), and per-step notes carry the knowledge an ingredient
list can't hold. Scaling branches on a three-type quantity model, so folk units multiply
sensibly or stay put with a note rather than inventing precision. The **handoff** mints a
capability link: the recipient reads and cooks the whole recipe with no account.

**Getting a recipe in.** Three doors, with paste-or-dictate as the primary one: free text (or
browser dictation typing into the field) goes to an LLM that extracts fields with amounts
preserved verbatim, falling back to a local line parser whenever the model is unavailable — so
the door always works. Autosuggest for ingredients, sources and cuisines from your own past
entries. A cover photo and per-step photos via Cloudinary, with iPhone HEIC conversion.

**The social layer, built through 2026-08/09.** A symmetric friend graph; a presence feed of
**shared meals** as Home (photo + dish name, optionally linked to a recipe — a post is not a
recipe, and there is deliberately **no like button**); a Friends|Everyone feed toggle; Browse
with **Recipes | Meals** tabs; read-only profiles; an app-wide **people directory** with name
search; a **Kept** shelf for bookmarking someone else's recipe (never a copy); and — newest —
writing a recipe **without abandoning the meal post you're in the middle of**; and the
**recipe-request loop** (#79) — anyone who can see a meal can ask the cook for the recipe, the
cook is notified in an **in-app inbox** (issei's first, which friend requests and accepts now
route through too), and answering it mints a handoff grant per requester, so a private recipe
reaches the people who asked without becoming public. The ask count is the cook's alone.

**Visibility** is a concrete per-item value (`public | friends | private`) stored literally,
never a live pointer; the profile setting only picks the create-form default and drives an
opt-in bulk sweep. `can_view` / `can_view_post` are the two read rules. Editing and deleting
stay owner-only: **read is not write**.

**Account and ops.** Signup/login, name/email/password edits, avatars, password reset by email
via SES, account deletion, in-app feedback, and a CI gate that blocks the backend deploy on a
red suite.

**Removed, on purpose, and not coming back:** the recipe lineage/family tree, the seed→tree
"garden" UI, and the consolidating shopping list. See `POSITIONING.md` and the note below.

---

## Re-sharing a Recipe You Don't Own

**Current state:** you can **keep** someone else's recipe (a bookmark), and you can hand on a
recipe **you own**. You cannot pass along a recipe that was handed to you — the handoff
endpoint requires ownership.

**What this adds:** the other half of keeping. If Lola's adobo reached you and your sibling
asks for it, you shouldn't have to route them back to Lola.

**Why it matters:** it's how a recipe actually travels. The current dead end is the most
common thing a satisfied recipient wants to do next.

**Implementation notes:** there's a security tripwire recorded from the #57 review — the
handoff dedupe path returns the existing row *whole*, including its live token and the owner's
private note. A re-share must mint a fresh grant from the resharer, never echo the owner's.
Attribution has to stay pointed at the cook, and this must not quietly become lineage: no
chain, no ancestry, no "passed through N kitchens".

---

## Search-only discovery at scale (and what blocking still doesn't cover)

**Current state:** everyone is discoverable — name and photo findable by any signed-in user,
while their content stays governed by `visibility`. That is deliberate (owner call,
2026-09-04) and is how the apps this one invites comparison with work: private controls what
people see, not whether you exist. **No opt-out is planned.**

**Blocking shipped in #85**, which was the primitive this section used to be about. A block is
mutually invisible (directory, Browse, the everyone-feed, each other's profile, posts, recipes
and friend suggestions), deletes the friendship, drops pending asks both ways, and is silent —
every denial is the same 404 a stranger gets. The implementation landed better than the plan
here specified: rather than patching `can_view_post` and `request_recipe` individually, the
check went *inside* `_resource_is_visible` **before** the `public` branch, so it covers every
recipe and post read through both rules at once. `GET /recipes/browse` needed a new
`get_current_user_optional` dependency, since it was the one public surface a block couldn't
otherwise reach.

**What blocking deliberately does NOT do, and don't claim it does:** it is not *unsend* — a
recipe you already handed that person stays readable to them forever, because the grant branch
survives (a *new* grant can't cross a block, though). And it is not a report or a mute:
**there is still no reporting, no moderation queue and no mute anywhere in the app.** Blocking
is the only safety primitive that exists, so never write "block and report". Reporting is the
honest next item in this area, and it needs somewhere for a report to *go* — which is a
process question, not just a table.

**What actually remains here:** `GET /friends/discover` still BROWSES ALL — no `?q=` returns
every user, newest first, 50 at a time (#85 only subtracted blocked people from it).
Instagram will find a name you type; it will not paginate the platform. At a dozen users
browse-all is the whole point of #80. Past a few hundred it is a scrapeable member list, and
`q` should become required. Not urgent; worth deciding before growth rather than during it.

**And one copy rule, still:** never describe issei as private-by-default without saying
findability isn't covered by the profile setting. It now has a *floor* — you can block, and
that removes you from that person's directory, Browse, feed and profile in both directions —
but a floor is not an opt-out, and Instagram doesn't claim one either.

---

## Multi-User Family Sharing

**Current state:** ownership is per-user — `Recipe.user_id` scopes every owner query — and
there is no `families` table. Cross-user *read* access now has three paths (a per-recipe
handoff grant, `public` visibility, and `friends` visibility over the symmetric friend graph),
but no shared library that several people co-own, and no non-owner write access anywhere.

**What this adds:** several family members share one library. Mom adds recipes; children and
grandchildren reach them without a grant issued per recipe per person. Role-based access
(owner edits, members read).

**Why it matters:** preserving family cooking across generations means more than one person
touching the same collection.

**Implementation notes:** `families` + `family_members` tables, and an extension of `can_view`
in `services/sharing.py` rather than a second rule. This would be **the first feature to give
a non-owner write access** — today editing and deleting are strictly owner-only via a
`user_id` filter — so the role model is new surface, not a loosened check. Note the friend
graph has since absorbed much of the *lightweight* sharing this was meant to solve, so scope
it honestly: what's left is genuine co-ownership, which is a smaller and sharper feature than
this section originally implied.

---

## Translation

**Current state:** recipes carry a `language` field (defaults to `"en"`) and nothing reads it.
A recipe is stored and displayed in whatever language it was entered.

**What this adds:** reading a recipe in your own language, building on that field.

**Why it matters:** this app is built for immigrant families, where the cooking generation and
the reading generation are often most comfortable in different languages. A parent writes in
Japanese; their kids read English. It matters at the shop too — you need the ingredient name
you can actually recognize on a shelf.

**Implementation notes:** a translation API triggered on read, cached per recipe+language.
**The hard part is the product rule, not the API:** this app preserves "a good splash"
verbatim, and a translator that renders it as "15 ml" breaks the one thing the app is for.
Imprecise amounts must round-trip as imprecise, which likely means translating the *words* and
leaving quantity classification untouched.

---

## Unit Conversion for Cross-Region Recipes

**Current state:** amounts are stored and shown exactly as written.

**What this adds:** an opt-in view that converts precise amounts between systems (metric ↔
US), so a recipe written in grams is cookable by someone with cups.

**Why it matters:** the same generational gap as translation, in a different dimension.

**Implementation notes:** only ever applies to `precise` quantities. `imprecise` and
`unmeasured` must pass through untouched — converting "a pinch" is the shopping-list mistake
again. Show it as a toggle over the original, never as a replacement, so what the cook
actually said stays visible.

---

## iOS Mobile App

**Current state:** no native app, and **not a PWA either** — there is no web manifest and no
service worker. The interim answer is just a mobile-first SPA (max-width 430px, bottom nav)
that a phone can bookmark to the home screen as a plain shortcut.

**What this adds:** faster performance, push notifications (which the recipe-request loop
above would immediately use), and better camera access for photographing a handwritten card.

**Why it matters:** the use case is a phone on a counter, not a laptop.

**Implementation notes:** React Native for both platforms; TestFlight for the beta group that
already exists. One gesture is worth stealing early even on web: **swipe-right-to-go-back**,
which testers reached for and which the router-state draft handling now makes safe.

**On audio:** no audio of a person is captured or stored today — see the note at the bottom.
Dictation is a keyboard substitute; the mic types into a field and the utterance is discarded.
Recorded audio would be new capability built from scratch.

---

## Richer Photo/Video Support

**Current state:** a cover photo per recipe **and** per-step photos both ship, via Cloudinary
with browser-side HEIC → JPEG conversion. `CookEvent.photo_url` exists on the model. Posts
carry a photo, which is the post. What's missing is video and any gallery.

**What this adds:** short video for steps where technique is the point (folding a dumpling,
what "translucent" looks like), and a gallery of other people's attempts at a recipe.

**Why it matters:** some techniques are far easier to show than to describe.

**Implementation notes:** the upload path exists and is reusable; video needs length/size caps
and compression. A gallery is a social entity and should reuse the post model rather than
inventing a parallel one — and it must not become a leaderboard.

---

## Cook-From-Ingredients (and What the Shopping List Taught Us)

**Current state:** there is no shopping list. One shipped, was never reached by any UI, and
was **removed** — the reason is the interesting part.

**What this could add:** the real job is "I want to cook this — what do I need, and what do I
already have?" Two honest shapes:
1. **Per-recipe checklist** — ingredients grouped by recipe with checkboxes, no cross-recipe
   arithmetic. The actual store task, with nothing that can lie.
2. **Cook-from-what-I-have** — the inverse and the differentiated one: given what's in the
   kitchen, which kept recipes are within reach? A tester reached for this independently
   ("photo of your fridge → recipes").

**Why the consolidating shopping list was removed:** it summed ingredients across recipes,
which means normalizing amounts, which is precisely what this app exists to refuse. On its
most common data it produced `"a good splash + a glug"` — not a total, just two source lines
concatenated. Every *real* total depended on the ingredient happening to appear in a
hand-maintained density table. And because no screen ever called it, a crash bug, several
wrong-total bugs, and an inverted unit-conversion ratio lived in it undetected for its entire
existence. Deleted rather than polished.

**Implementation notes:** ingredient canonicalization ("garlic cloves" vs "minced garlic" vs
"garlic") is the real prerequisite for either shape — and for search — so build it as its own
layer, not inside a list feature. Start with an alias table; fuzzy or LLM normalization later.

---

## Smaller, Known, Worth Doing

- **Parser extracts every field.** The LLM parse fills name, description, cuisine, servings,
  source, ingredients and steps, but not diet or ready-in, so those get typed by hand after a
  parse that felt complete.
- **Browse filters beyond the three that ship.** Cuisine, Diet and Ready-In dropdowns are
  live (with fuzzy cuisine matching for typo'd user values); the backlog item asking for
  "dietary filters" was already satisfied. What's genuinely parked is anything *more* —
  ingredient-based or allergen filtering — which waits on ingredient canonicalization and on
  a corpus worth filtering. Filters over a dozen recipes are decoration.
- **A load test for the API.** One Fargate task, `desiredCount: 1`, and no idea where it
  falls over. Cheap to learn before it matters.
- **Rate limiting.** `app/main.py` mounts CORS and nothing else. Login, forgot-password and
  the people directory are all unthrottled — the last one turns an accepted disclosure into a
  harvesting loop.
- **A deploy that can't half-ship.** The backend deploy is gated on a green suite, but Vercel
  isn't — so a red backend suite ships the frontend alone and prod calls endpoints that don't
  exist. That happened twice on 2026-09-03 and cost a day of invisible non-deployment.
- **Store-bought shortcuts** — when you don't feel like cooking, suggest the shop-bought
  version of a dish you keep. Idea only.

---

## What I'd Build First

In order:

*(Blocking was #1 here until #85 shipped it — the floor for showing the app to people you
don't know. What that left uncovered is **reporting**, which is now folded into item 5.)*

1. **A deploy that can't half-ship** — infrastructure, unglamorous, and it already bit twice.
2. **Re-sharing a recipe you don't own** — the other half of keeping, and the most common next
   thing a happy recipient wants.
3. **Translation** — the deepest feature that speaks directly to the core audience, gated on
   getting the imprecise-amount rule right.
4. **Multi-user family sharing** — still real, but scope it to genuine co-ownership now that
   the friend graph covers lightweight sharing.
5. **Reporting** — blocking protects one person from one person; reporting is what a stranger
   needs when the problem isn't aimed only at them. Deliberately below the others because it
   is mostly a process question (where does a report go, who reads it) rather than a table.
6. **iOS app** (with swipe-back brought to web first), then **video/gallery**, then
   **ingredient canonicalization** — which unlocks cook-from-ingredients and better search,
   and which nothing currently depends on.

---

## Not Built: Audio

Worth stating outright, because a column name invites the assumption. **There is no audio
anywhere in this product** — no recording, no playback, no transcription. `Step.voice_note` is
a `Text` column typed into a plain text input by whoever wrote the recipe down, and it renders
under its step labelled "a note on this step".

Actually recording a person — their explanation of a step, in their own voice — is a real and
appealing future feature, and it would be the strongest version of this app's premise. It is
also a genuinely new subsystem: browser capture, storage and transcoding, playback,
transcription for search and for anyone who can't play audio, and a much larger privacy
surface (a voice is biometric-adjacent in a way typed text isn't). It is not on the roadmap
above because it hasn't been scoped, and it must not be described as shipped or partially
shipped.

If it is ever built, rename the column at the same time. Leaving typed text and recorded audio
sharing one field name is how the claim gets made by accident.
