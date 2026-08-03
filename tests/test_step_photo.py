"""A step's optional technique photo.

The recipient of a handoff has often never tasted OR seen the dish. Prose can't
carry "fold it like this" or "cook until it looks like this", so a photo on the
step is the only honest way to hand that part over — which means it has to reach
the reader, including the unauthenticated invite reader, not just be storable.

These tests split deliberately into two groups:
  • the model/schema/read path;
  • the WRITE path through the recipes router. That path was initially unwired —
    the Step(...) constructors build rows field-by-field, so photo_url validated
    into StepCreate and was then silently dropped. Both constructors now pass it
    (create, and the PATCH steps-replace). The PATCH one is the dangerous half: a
    PATCH deletes and rebuilds every step, so without it any plain text edit would
    have erased every step photo on the recipe. Kept as tests rather than a
    field that accepts input and discards it is the exact defect worth pinning.
"""

import pytest

from app.models.recipe import Recipe
from app.models.step import Step
from app.schemas.recipe import StepCreate, StepResponse

PHOTO = "https://res.cloudinary.com/demo/image/upload/v1/issei/recipes/fold.jpg"


def _seed_recipe_with_step_photo(db_session, user_id, photo_url=PHOTO):
    """Write a step photo at the ORM level, bypassing the un-wired router."""
    recipe = Recipe(user_id=user_id, name="Dumplings")
    db_session.add(recipe)
    db_session.flush()
    db_session.add(
        Step(
            recipe_id=recipe.id,
            position=1,
            content="Pleat the wrapper into a half-moon.",
            photo_url=photo_url,
        )
    )
    db_session.commit()
    return recipe.id


# ── model + schema ────────────────────────────────────────────────────────────


def test_photo_url_is_optional_on_the_model(db_session, make_user):
    """Almost no step has a photo, so the column must default to absent."""
    user, _ = make_user()
    recipe = Recipe(user_id=user.id, name="Adobo")
    db_session.add(recipe)
    db_session.flush()
    step = Step(recipe_id=recipe.id, position=1, content="Brown the chicken.")
    db_session.add(step)
    db_session.commit()
    db_session.refresh(step)
    assert step.photo_url is None


def test_step_schemas_carry_photo_url():
    assert StepCreate(position=1, content="Fold it.").photo_url is None
    assert StepCreate(position=1, content="Fold it.", photo_url=PHOTO).photo_url == PHOTO
    # from_attributes: the response reads the column off the ORM object, so a
    # missing field name here would silently strip the photo on every read.
    assert "photo_url" in StepResponse.model_fields


# ── read path: the photo has to reach every reader ───────────────────────────


def test_owner_read_returns_the_step_photo(client, db_session, make_user):
    user, headers = make_user()
    rid = _seed_recipe_with_step_photo(db_session, user.id)
    body = client.get(f"/recipes/{rid}", headers=headers).json()
    assert body["steps"][0]["photo_url"] == PHOTO


def test_a_step_without_a_photo_reads_as_null(client, db_session, make_user):
    """Explicit null rather than an absent key — the frontend branches on it."""
    user, headers = make_user()
    recipe = Recipe(user_id=user.id, name="Adobo")
    db_session.add(recipe)
    db_session.flush()
    db_session.add(Step(recipe_id=recipe.id, position=1, content="Brown it."))
    db_session.commit()
    body = client.get(f"/recipes/{recipe.id}", headers=headers).json()
    assert body["steps"][0]["photo_url"] is None


def test_invite_preview_exposes_the_step_photo(client, db_session, make_user):
    """The recipient is the whole point of the feature.

    They read from a capability link with no account, and they're the one person
    who has never seen the dish — so a technique photo withheld here would be
    withheld from exactly the reader it exists for. `InvitePreview` reuses
    `StepResponse`, so this passes by construction; it's pinned because the
    preview's field list is hand-curated (notes/account ids are deliberately
    withheld) and a future tightening could drop this by accident.
    """
    owner, oheaders = make_user()
    rid = _seed_recipe_with_step_photo(db_session, owner.id)
    token = client.post(
        f"/recipes/{rid}/handoff", json={"to_email": "friend@example.com"}, headers=oheaders
    ).json()["token"]

    body = client.get(f"/recipes/invite/{token}").json()  # no auth header
    assert body["steps"][0]["photo_url"] == PHOTO


# ── write path: NOT wired in the router ──────────────────────────────────────
#
# Both tests below drive the real endpoints. They fail today because
# These two pin the router wiring. They were xfail until `photo_url=` was added to
# both Step(...) constructors; they are plain tests now, so a future refactor that
# drops the field again fails loudly instead of reverting to "expected failure".


def test_photo_url_persists_through_create(client, make_user):
    _, headers = make_user()
    r = client.post(
        "/recipes",
        json={
            "name": "Dumplings",
            "steps": [
                {"content": "Pleat the wrapper.", "position": 1, "photo_url": PHOTO}
            ],
        },
        headers=headers,
    )
    assert r.status_code == 201
    body = client.get(f"/recipes/{r.json()['id']}", headers=headers).json()
    assert body["steps"][0]["photo_url"] == PHOTO


def test_photo_url_survives_a_patch_that_replaces_steps(client, db_session, make_user):
    """A PATCH deletes and rebuilds every step, so an un-wired field is worse
    than unsaveable: a plain text edit would wipe photos already on the recipe."""
    user, headers = make_user()
    rid = _seed_recipe_with_step_photo(db_session, user.id)
    r = client.patch(
        f"/recipes/{rid}",
        json={
            "steps": [
                {"content": "Pleat the wrapper firmly.", "position": 1, "photo_url": PHOTO}
            ]
        },
        headers=headers,
    )
    assert r.status_code == 200
    body = client.get(f"/recipes/{rid}", headers=headers).json()
    assert body["steps"][0]["photo_url"] == PHOTO
