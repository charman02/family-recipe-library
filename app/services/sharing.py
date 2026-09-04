"""Read authorization and effective visibility for recipes and posts.

This replaces the old `lineage.py`. The app is a person→person bridge — one
recipe handed to one person — not a family-lineage network, so recipes no longer
form trees. That collapsed the old "your lineage root's visibility" walk into a
statement about the recipe in front of you.

Visibility (issei #68) is CONCRETE and per-item — one of three literal values on a
Recipe or a Post:

  - "public"  → anyone can read it (and it can appear in Browse).
  - "friends" → the owner's accepted friends can read it; nobody else.
  - "private" → only the owner (plus, for recipes, accepted handoff grantees).

A User also has `profile_visibility` ("public" | "private", default private) — but that
is NOT consulted here. It only (a) picks the default the create form auto-selects for a
NEW item ("Everyone" on a public profile, "Friends only" on a private one) and (b) drives
the optional bulk "make everything public / friends-only" sweep. So a label never lies:
"Friends only" means friends only, permanently, whatever the profile later becomes.
(This replaced an earlier "inherit"/follow-the-profile design whose label couldn't be a
flat "Friends only" without misrepresenting the live-follow behavior.)

`can_view` (recipes) and `can_view_post` (posts) are the single read rules — every read
of the respective resource funnels through one of them. Keep it that way; a second,
subtly different rule elsewhere is how private content leaks. Both share
`_resource_is_visible`, the one truth table, so the recipe and post answers can't drift.

The handoff grant is ORTHOGONAL: someone handed a recipe can read THAT recipe whatever
its visibility or the friendship says. It's checked only for recipes (posts have no
handoff), and only after the visibility rule says no.
"""

from app.services.blocks import is_blocked
from app.services.friends import are_friends


def _resource_is_visible(
    owner_id, viewer_id, visibility, db, is_friend=None, blocked=None
) -> bool:
    """The shared visibility truth table for a recipe or a post. Answers read access for
    a NON-owner, NON-grantee viewer — callers handle owner and (for recipes) handoff
    separately.

    blocked → never visible, whatever the visibility says. Checked FIRST, and that order is
              load-bearing: a block has to beat `public`, or blocking someone would leave
              every public recipe and post of theirs still on your screen, which is the exact
              thing blocking exists to stop (#85). Mutual by design — `is_blocked` answers for
              a block in either direction, because one-way blocking doesn't achieve it.
    public  → always visible.
    private → never visible here.
    friends → visible iff the viewer is an accepted friend of the owner.

    `is_friend` / `blocked` let a caller that already knows the answer pass it in (a profile
    page checking many of one owner's items, or a feed page that precomputed `blocked_ids`
    once) so neither is re-queried per item. When None each is resolved here. Only the
    ANSWERS are ever precomputed — never the logic; this stays the one rule.
    """
    if blocked is None:
        blocked = is_blocked(viewer_id, owner_id, db)
    if blocked:
        return False
    if visibility == "public":
        return True
    if visibility == "private":
        return False
    # "friends"
    if is_friend is not None:
        return is_friend
    return are_friends(viewer_id, owner_id, db)


def effective_visibility(recipe, db=None):
    """A recipe's visibility, already concrete ("public" | "friends" | "private"). Kept
    as a named function because Browse and other callers read through it, and it once did
    real work (resolving an inherited value); now it's the identity. `db` is accepted and
    ignored so callers don't have to care."""
    return recipe.visibility


def can_view(recipe, user, db, is_friend=None, is_grantee=None, blocked=None):
    """The single read rule for a recipe: owner OR the visibility rule allows this
    viewer OR they hold an accepted handoff for this recipe.

    Deliberately NOT the same question as "may edit": editing stays owner-only,
    enforced separately in patch_recipe. A grantee can read and cook a recipe they
    were handed; they cannot change someone else's record of it.

    A BLOCK beats the visibility rule but NOT the grant (#85). That asymmetry is
    deliberate: you genuinely handed this person that recipe, it is on their Kept shelf and
    they may have cooked from it, so a block means "no new contact", not "unsend". Revoking
    would be the only place in the app where access is taken back after being given. So a
    blocked viewer keeps reading the ONE recipe they hold a grant for, and nothing else.

    `is_friend` / `is_grantee` / `blocked` are optional precomputed answers a caller checking
    many of one owner's items (a profile page) can pass so the friendship, the handoff grant
    and the block aren't re-queried per item. All default to None → resolved here."""
    from app.models.handoff import Handoff

    if recipe.user_id == user.id:
        return True
    if _resource_is_visible(
        recipe.user_id, user.id, recipe.visibility, db, is_friend, blocked
    ):
        return True
    # Handoff grant is orthogonal — a grantee reads their one recipe regardless of the
    # recipe's visibility or any friendship.
    if is_grantee is not None:
        return is_grantee
    return (
        db.query(Handoff)
        .filter(
            Handoff.recipe_id == recipe.id,
            Handoff.to_user_id == user.id,
            Handoff.state == "accepted",
        )
        .first()
        is not None
    )


def can_view_post(post, user, db, is_friend=None, blocked=None):
    """The single read rule for a post: owner OR the visibility rule allows this
    viewer. Posts have no handoff grant, so that branch is absent — the truth table
    is otherwise identical to a recipe's (shared via `_resource_is_visible`).

    `is_friend` / `blocked` are the same optional precomputed escape hatches as can_view.
    A post has no grant, so unlike a recipe a block denies it outright (#85)."""
    if post.user_id == user.id:
        return True
    return _resource_is_visible(
        post.user_id, user.id, post.visibility, db, is_friend, blocked
    )
