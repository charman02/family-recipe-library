# Future Roadmap

This document outlines planned features and improvements for Issei — a full-stack app for sending one recipe from the person who cooks it to the person who just tasted it and asked for it (*issei* = "first generation"). See `POSITIONING.md` for the positioning and the explicit list of things the app does *not* do. The current build (FastAPI backend + React frontend) attributes a recipe to a **person** (the dish is the title, the person is the byline), preserves their imprecise measurements verbatim rather than normalizing them, and carries per-step notes for the knowledge an ingredient list can't hold — in a warm, playful "kitchen" UI. It includes recipe management, serving-size scaling (which preserves folk measures like "3 soup spoons" rather than inventing precision), cover-photo upload, and the handoff flow — shareable capability links that let a recipient read and cook the full recipe with no account — over private → shared → public visibility. The roadmap below represents the natural evolution toward a full product.

---

## Multi-User Family Sharing

**Current state:** Ownership is per-user — `Recipe.user_id` scopes every owner query — and there is no `families` table. Cross-user access does exist, but only through the handoff/grant path (per-recipe `visibility` plus `handoffs`, described below): someone can be *given* a recipe, but there is no shared library that several people co-own.

**What this adds:** Multiple family members share a recipe library. Mom adds recipes, children and grandchildren access them. Role-based access (owner can edit, members can read) rather than a grant per recipe per person.

**Why it matters:** The core use case — preserving family cooking across generations — requires multiple people to access the same library. A recipe added by mom should be visible to her children without manual sharing.

**Implementation notes:** Add `families` and `family_members` tables. Update authorization checks from `user_id == current_user.id` to `family_id in current_user.families` — in practice that means extending `can_view` in `services/sharing.py`, which is already the single read-authorization rule. Note this would be the first feature to give a non-owner **write** access to a recipe; today editing and deleting are strictly owner-only (a `user_id` filter in `patch_recipe`/`delete_recipe`), so the role model is new surface, not a loosened check.

**Note:** The token-based invitation machinery this would have needed is **already shipped** — email invites that auto-accept on signup, plus shareable capability links (`/invite/:token`) claimable by any signed-in holder. So this feature is now specifically the *shared-library* half: a group that co-owns recipes, rather than a grant issued per recipe per person. The families design should build on the existing `handoffs`/`visibility` path rather than duplicate it.

---

## Web Frontend — shipped

**Web frontend — shipped.** React + Vite + Tailwind SPA in `frontend/`, mobile-first, for inputting, browsing, scaling, and sharing recipes from any device — the interface that makes the product usable by non-technical users (the parents and grandparents who are the primary recipe contributors), not just the `/docs` page.

---

## iOS Mobile App

**Current state:** No mobile app exists. The web frontend (now shipped) is mobile-responsive as an interim solution.

**What this adds:** A native iOS experience with faster performance, push notifications for family recipe updates, and camera access for photographing handwritten recipes or dishes.

**Why it matters:** The use case is fundamentally mobile — someone cooking in a kitchen checks a recipe on their phone, not a laptop. Native mobile also enables things a web app can't do well, like hands-free navigation through the steps while your hands are covered in flour. (**No audio of a person is captured or stored today** — see the note at the bottom of this file. Dictation exists as a keyboard substitute — the mic types into a text field via the browser and the utterance is discarded — but recorded audio of someone speaking would be new capability built from scratch.)

**Implementation notes:** React Native for cross-platform coverage (iOS and Android), TestFlight for beta testing with initial users, App Store launch after beta validation.

---

## Translation

**Current state:** Recipes have a `language` field (defaults to "en") but no translation functionality exists. A recipe is stored and displayed in whatever language it was entered.

**What this adds:** Automatic translation of recipes into the reader's preferred language, building on the existing `language` field. A recipe entered by a Japanese-speaking parent could be read in English by their kids, or vice versa.

**Why it matters:** This app is built for Asian immigrant families, where it's common for the cooking generation and the reading generation to be most comfortable in different languages. A parent might write a recipe in Japanese; their kids might only read English fluently. Translation also matters practically — when someone is shopping for ingredients, they need the ingredient names in a language they can search for or recognize at the store.

**Implementation notes:** Likely uses a translation API (e.g., DeepL or Google Translate) triggered on read, with caching to avoid re-translating the same recipe repeatedly. The existing `language` field on recipes already tracks the source language, which is the foundation this feature builds on.

---

## Richer Photo/Video Support

**Current state:** A single cover photo per recipe is **shipped** — `Recipe.cover_photo_url`, uploaded via `POST /upload/recipe-photo` to Cloudinary, including automatic iPhone HEIC → JPEG conversion in the browser. `CookEvent.photo_url` also exists on the model. What's missing is everything beyond one still image per recipe: no per-step media, no video, no gallery.

**What this adds:** Media at more levels than the cover shot: photos or short videos for individual steps (especially useful for techniques that are hard to describe in words), and a community gallery where people who cooked the recipe can share their own results.

**Why it matters:** Some cooking techniques are much easier to show than describe — how to fold a dumpling, what "until the onions are translucent" actually looks like, the right consistency for a sauce. Photos of the final dish also help confirm "did I make this right?" A gallery of other people's attempts adds a community dimension that text alone can't.

**Implementation notes:** The Cloudinary upload path already exists and can be reused; what's new is media tables linked to steps and a "gallery post" entity, rather than a single URL column on the recipe. Video would need size/length limits and probably compression on upload.

---

## Cook-From-Ingredients (and What the Shopping List Taught Us)

**Current state:** There is no shopping list. One shipped, unreached by any UI, and was **removed** — see the note below, because the reason is the interesting part.

**What this could add:** The genuine job-to-be-done is "I want to cook this — what do I need, and what do I already have?" Two honest shapes for that:
1. **Per-recipe checklist** — group the ingredients by recipe with checkboxes, no cross-recipe arithmetic. Delivers the actual store task with nothing that can lie.
2. **Cook-from-what-I-have** — the inverse, and the more differentiated one: given what's in the kitchen, which kept recipes are within reach? A tester reached for this idea independently ("photo of your fridge → recipes").

**Why the consolidating shopping list was removed:** It summed ingredients across recipes — which means normalizing amounts, which is precisely what this app exists to refuse. On its most common data it produced `"a good splash + a glug"`: not a shopping list, just two source lines concatenated. Every *real* total also depended on the ingredient happening to appear in a hand-maintained density table, which only ever grew when someone noticed a wrong number. And because no screen ever called it, a crash bug, several wrong-total bugs, and an inverted unit-conversion ratio all lived in it undetected for its entire existence. Deleted rather than polished.

**Implementation notes:** Ingredient canonicalization ("garlic cloves" vs. "minced garlic" vs. "garlic") is the real prerequisite for either shape, and it's needed for search too — so it's worth building as its own layer rather than inside a list feature. Start with an alias table (canonical name → known aliases) for common ingredients; fuzzy matching or an LLM normalization pass is a later refinement.

---

## What I'd Build First

In order of priority:

1. **Account deletion / anonymization** — the highest-priority *next* step now that the web frontend and the sharing/handoff system have shipped. There is currently no way for a user to delete their account, and a recipe someone was handed carries its owner's name. An anonymize-or-delete flow needs to answer what happens to grants already issued and to a recipe sitting on a public Browse feed. This is a near-term correctness/privacy gap, not an exploratory addition. (Recipe deletion itself is soft-delete only — `deleted_at` — because losing a family recipe permanently is unacceptable for this use case.)
2. **Multi-user family sharing** — without this, the product can't fully fulfill its actual purpose. A recipe my mom adds should be visible to me and my siblings without needing separate accounts and manual copying. Per-recipe `visibility` + handoffs now provide a lightweight sharing path, but a proper families model is still closer to a missing core feature than an enhancement, so it ranks above the more exploratory additions below.
3. **iOS mobile app** — now that the web frontend is live, a native mobile experience makes sense given that the real use case (checking a recipe while cooking, contributing a recipe from a phone) is fundamentally mobile-first.
4. **Translation** — highest priority among the "deeper feature" additions, since it directly addresses the core audience: families where the cooking generation and the reading generation may not share a primary language.
5. **Richer photo/video support** — a cover photo per recipe already ships via Cloudinary; going further (per-step media, video, community gallery) meaningfully improves usability for techniques that are hard to describe in text.
6. **Ingredient canonicalization** — the most clearly-scoped technical improvement, and now a prerequisite rather than a nicety: it's what any cook-from-ingredients or ingredient-search feature would be built on. Lower priority than the above because nothing currently depends on it.

---

## Not Built: Audio

Worth stating outright, because a column name invites the assumption. **There is no audio anywhere in this product** — no recording, no playback, no transcription. `Step.voice_note` is a `Text` column typed into a plain text input by whoever wrote the recipe down, and it renders under its step labelled "a note on this step".

Actually recording a person — their explanation of a step, in their own voice — is a real and appealing future feature, and it would be the strongest version of this app's premise. It is also a genuinely new subsystem: capture in the browser, storage and transcoding, playback, transcription for search and for anyone who can't play audio, and a much larger privacy surface (a voice is biometric-adjacent in a way typed text isn't). It is not on the roadmap above because it hasn't been scoped, and it must not be described as shipped or partially shipped.

If it is ever built, rename the column at the same time. Leaving typed text and recorded audio sharing one field name is how the claim gets made by accident.
