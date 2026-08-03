"""Read authorization and effective visibility for a recipe.

This replaces the old `lineage.py`. The app is a person→person bridge — one
recipe handed to one person — not a family-lineage network, so recipes no longer
form trees. That collapses what used to be the interesting part of this module:
visibility was "your lineage root's visibility", walked up a parent chain, and
`can_view` matched grants against that root. With no trees, a recipe IS its own
root, so both reduce to a statement about the recipe in front of you.

The simplification was verified safe against production before it was made: zero
recipes had a `parent_recipe_id`, so `root_of()` was already the identity function
on every real row and no existing authorization outcome can change.

`can_view` is the single read-authorization rule that every recipe read funnels
through (`get_recipe`, the scale endpoint, cook, handoff). Keep it that way — a
second, subtly different rule elsewhere is how private recipes leak.
"""


def effective_visibility(recipe, db=None):
    """A recipe's visibility is its own. `db` is accepted and ignored so callers
    don't have to care that the lookup no longer needs one."""
    return recipe.visibility


def can_view(recipe, user, db):
    """public OR owner OR holds an accepted handoff for this recipe.

    Note this is deliberately NOT the same question as "may edit": editing stays
    owner-only, enforced separately in patch_recipe. A grantee can read and cook a
    recipe they were handed; they cannot change someone else's record of it.
    """
    from app.models.handoff import Handoff

    if recipe.user_id == user.id:
        return True
    if recipe.visibility == "public":
        return True
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
