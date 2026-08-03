import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient_section import IngredientSection
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.cook_event import CookEvent
from app.models.handoff import Handoff
from app.schemas.recipe import (
    RecipeCreate,
    RecipeResponse,
    RecipeUpdate,
    IngredientResponse,
    IngredientSectionResponse,
    IngredientSuggestions,
    StepResponse,
    CookIn,
    HandoffIn,
    HandoffResponse,
    InvitePreview,
)
from app.services.scaling import scale_ingredient
from app.services.sharing import effective_visibility, can_view
from app.services.growth import soul_count, growth_stage, growth_vitality

from datetime import datetime, timezone

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _attach_growth_fields(recipe, db):
    """Compute the growth-state counts the frontend reads. Small N per request."""
    cooks = db.query(CookEvent).filter(CookEvent.recipe_id == recipe.id).all()
    recipe.cook_count = len(cooks)
    recipe.owner_cook_count = sum(1 for c in cooks if c.user_id == recipe.user_id)
    recipe.last_cooked_at = max((c.cooked_at for c in cooks), default=None)
    recipe.shared_with_count = (
        db.query(Handoff)
        .filter(Handoff.recipe_id == recipe.id, Handoff.state == "accepted")
        .count()
    )
    soul = soul_count(recipe)
    recipe.soul_count = soul
    recipe.growth_stage = growth_stage(soul, recipe.cook_count)
    recipe.growth_vitality = growth_vitality(recipe.cook_count, recipe.shared_with_count)
    return recipe


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    recipe_in: RecipeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_recipe = Recipe(
        user_id=current_user.id,
        name=recipe_in.name,
        cover_photo_url=recipe_in.cover_photo_url,
        description=recipe_in.description,
        story=recipe_in.story,
        servings=recipe_in.servings,
        prep_time_minutes=recipe_in.prep_time_minutes,
        cuisine=recipe_in.cuisine,
        diet=recipe_in.diet,
        source=recipe_in.source,
        notes=recipe_in.notes,
        language=recipe_in.language,
        visibility=recipe_in.visibility,
    )
    db.add(new_recipe)
    # flush to get new_recipe.id before committing
    db.flush()

    # Origin attribution — "from Lola Remedios · Cebu" — is the byline, and it
    # STAYS. It used to also write a `ghost_ancestor` row so recipe #1 read as a
    # two-generation lineage; with no trees that row had no reader, so the
    # attribution string on the recipe is the whole feature now.
    if recipe_in.origin is not None:
        o = recipe_in.origin
        parts = [o.name] + [p for p in (o.place, o.year) if p]
        new_recipe.origin_attribution = " · ".join(parts)

    for section_in in recipe_in.ingredient_sections:
        new_section = IngredientSection(
            recipe_id=new_recipe.id,
            name=section_in.name,
            position=section_in.position,
        )
        db.add(new_section)
        db.flush()

        for ing_in in section_in.ingredients:
            db.add(
                Ingredient(
                    recipe_id=new_recipe.id,
                    section_id=new_section.id,
                    name=ing_in.name,
                    quantity_text=ing_in.quantity_text,
                    quantity_value=ing_in.quantity_value,
                    unit=ing_in.unit,
                    quantity_type=ing_in.quantity_type,
                    notes=ing_in.notes,
                    position=ing_in.position,
                )
            )

    for ing_in in recipe_in.ingredients:
        db.add(
            Ingredient(
                recipe_id=new_recipe.id,
                section_id=None,
                name=ing_in.name,
                quantity_text=ing_in.quantity_text,
                quantity_value=ing_in.quantity_value,
                unit=ing_in.unit,
                quantity_type=ing_in.quantity_type,
                notes=ing_in.notes,
                position=ing_in.position,
            )
        )

    for step_in in recipe_in.steps:
        db.add(
            Step(
                recipe_id=new_recipe.id,
                position=step_in.position,
                content=step_in.content,
                section_header=step_in.section_header,
                voice_note=step_in.voice_note,
            )
        )

    db.commit()
    db.refresh(new_recipe)
    _attach_growth_fields(new_recipe, db)
    return new_recipe


@router.post(
    "/{recipe_id}/handoff", response_model=HandoffResponse, status_code=status.HTTP_201_CREATED
)
def handoff_recipe(
    recipe_id: int,
    handoff_in: HandoffIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = (
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id,
            Recipe.user_id == current_user.id,
            Recipe.deleted_at == None,
        )
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # NOTE the query above already requires current_user to OWN the recipe, which
    # is the whole authorization question now. It used to walk to the lineage root
    # and re-check ownership there, to stop someone who owned a branch off a
    # victim's root from forging a grant onto that root — a defense that existed
    # only because grants bound to the root. No trees, no forgery surface.

    # Resolve grantee: an in-app user (instant-accept) or an email invite (pending).
    to_user_id = handoff_in.to_user_id
    to_email = handoff_in.to_email
    resolved_user = None
    if to_user_id is not None:
        resolved_user = db.query(User).filter(User.id == to_user_id).first()
        if resolved_user is None:
            raise HTTPException(status_code=404, detail="User not found")

    # Idempotent per (root, grantee): return the existing grant if present.
    # Link-only handoffs (no recipient at all) are deliberately NOT deduped — each
    # is an independent shareable grant, so two links can be claimed by two people
    # without the second stealing the first's access.
    if resolved_user is not None or to_email:
        existing_q = db.query(Handoff).filter(Handoff.recipe_id == recipe.id)
        if resolved_user is not None:
            existing = existing_q.filter(Handoff.to_user_id == resolved_user.id).first()
        else:
            existing = existing_q.filter(Handoff.to_email == to_email).first()
        if existing is not None:
            return existing

    handoff = Handoff(
        recipe_id=recipe.id,
        from_user_id=current_user.id,
        to_user_id=(resolved_user.id if resolved_user else None),
        to_email=(None if resolved_user else to_email),
        state=("accepted" if resolved_user else "pending"),
        note=handoff_in.note,
        token=secrets.token_urlsafe(32),
    )
    db.add(handoff)
    db.commit()
    db.refresh(handoff)
    return handoff


@router.post("/{recipe_id}/cook")
def cook_recipe(
    recipe_id: int,
    cook_in: CookIn | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at == None).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not can_view(recipe, current_user, db):
        raise HTTPException(status_code=404, detail="Recipe not found")

    db.add(
        CookEvent(
            recipe_id=recipe_id,
            user_id=current_user.id,
            photo_url=(cook_in.photo_url if cook_in else None),
            note=(cook_in.note if cook_in else None),
        )
    )
    db.commit()
    count = db.query(CookEvent).filter(CookEvent.recipe_id == recipe_id).count()
    return {"cook_count": count}


@router.get("", response_model=list[RecipeResponse])
def list_recipes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipes = (
        db.query(Recipe)
        .filter(Recipe.user_id == current_user.id, Recipe.deleted_at == None)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .all()
    )
    for r in recipes:
        _attach_growth_fields(r, db)
    return recipes


@router.get("/browse", response_model=list[RecipeResponse])
def browse_recipes(db: Session = Depends(get_db)):
    recipes = (
        db.query(Recipe)
        .filter(Recipe.deleted_at == None)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .order_by(Recipe.created_at.desc())
        .all()
    )
    recipes = [r for r in recipes if effective_visibility(r, db) == "public"]
    for r in recipes:
        _attach_growth_fields(r, db)
        # Browse is unauthenticated — don't leak per-owner activity on the public
        # feed. The growth badge only needs cook_count/child_count/has_grandchildren.
        r.owner_cook_count = 0
        r.last_cooked_at = None
        r.shared_with_count = 0
    return recipes


@router.get("/shared", response_model=list[RecipeResponse])
def shared_with_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Declared BEFORE get_recipe so the literal "/shared" path is matched first;
    # otherwise GET /recipes/{recipe_id} would capture recipe_id="shared".
    granted_ids = [
        h.recipe_id
        for h in db.query(Handoff)
        .filter(Handoff.to_user_id == current_user.id, Handoff.state == "accepted")
        .all()
    ]
    if not granted_ids:
        return []
    recipes = (
        db.query(Recipe)
        .filter(
            Recipe.id.in_(granted_ids),
            Recipe.user_id != current_user.id,
            Recipe.deleted_at == None,
        )
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .all()
    )
    for r in recipes:
        _attach_growth_fields(r, db)
    return recipes


@router.get("/ingredient-suggestions", response_model=IngredientSuggestions)
def ingredient_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The signed-in user's own ingredient vocabulary, for the add-form autosuggest.

    Declared BEFORE get_recipe so the literal path wins; otherwise
    GET /recipes/{recipe_id} captures recipe_id="ingredient-suggestions" (same
    reason /shared and /browse sit up here).

    SCOPE IS THE SECURITY PROPERTY. The join is pinned to
    `Recipe.user_id == current_user.id`, so a suggestion can only ever be a word
    this user typed themselves. Deliberately NOT widened to public recipes or to
    recipes handed off to this user, even though they're readable: an ingredient
    list is a behavioural trace, and a name that appears here because someone
    ELSE cooked with it tells you about their kitchen while looking like it came
    from yours. Autocomplete is exactly the surface where that inference is
    cheapest to make and hardest to notice, so the "readable" set and the
    "suggestible" set are kept different on purpose. Soft-deleted recipes drop
    out too — a deleted recipe shouldn't keep whispering its contents back.
    """
    rows = (
        db.query(Ingredient.name)
        .join(Recipe, Recipe.id == Ingredient.recipe_id)
        .filter(Recipe.user_id == current_user.id, Recipe.deleted_at == None)
        .all()
    )

    # Fold case/whitespace in Python rather than SQL: picking a representative
    # spelling for a case-insensitive group needs dialect-specific tricks, and
    # this set is one user's own ingredients — small enough that clarity and
    # SQLite/Postgres portability are worth more than pushing it down.
    counts: dict[str, int] = {}
    spellings: dict[str, dict[str, int]] = {}
    for (raw,) in rows:
        name = (raw or "").strip()
        if not name:
            continue
        key = name.casefold()
        counts[key] = counts.get(key, 0) + 1
        spellings.setdefault(key, {})
        spellings[key][name] = spellings[key].get(name, 0) + 1

    # Most-used first so the words someone reaches for daily are the ones they
    # never have to finish typing; alphabetical within a tie for a stable order.
    ordered = sorted(counts, key=lambda k: (-counts[k], k))
    names = [max(spellings[k].items(), key=lambda kv: (kv[1], kv[0]))[0] for k in ordered]
    # Bounded: past a few hundred the tail is never reached by a prefix match, and
    # the whole list is downloaded once on a phone.
    return IngredientSuggestions(names=names[:300])


@router.post("/handoffs/{handoff_id}/accept", response_model=HandoffResponse)
def accept_handoff(
    handoff_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = db.query(Handoff).filter(Handoff.id == handoff_id).first()
    if h is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    # Only the intended recipient may accept (by user id or matching email).
    is_recipient = (h.to_user_id == current_user.id) or (
        h.to_email is not None and h.to_email == current_user.email
    )
    if not is_recipient:
        raise HTTPException(status_code=404, detail="Invite not found")
    h.to_user_id = current_user.id
    h.state = "accepted"
    db.commit()
    db.refresh(h)
    return h


@router.get("/invite/{token}", response_model=InvitePreview)
def preview_invite(token: str, db: Session = Depends(get_db)):
    # Unauthenticated read of a handed-off recipe. The token IS the capability:
    # whoever holds the link was given the dish, so they can read all of it
    # without an account — that's the handoff. What stays out of reach is bounded
    # by InvitePreview (no private `notes`, no account ids), not by a signup gate.
    h = db.query(Handoff).filter(Handoff.token == token).first()
    if h is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    recipe = (
        db.query(Recipe)
        .filter(Recipe.id == h.recipe_id, Recipe.deleted_at == None)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .first()
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    _attach_growth_fields(recipe, db)
    from_name = None
    if recipe.user is not None:
        from_name = (
            " ".join(p for p in [recipe.user.first_name, recipe.user.last_name] if p) or None
        )
    return InvitePreview(
        recipe_id=recipe.id,
        name=recipe.name,
        from_name=from_name,
        origin_attribution=recipe.origin_attribution,
        story=recipe.story,
        growth_stage=recipe.growth_stage,
        growth_vitality=recipe.growth_vitality,
        cover_photo_url=recipe.cover_photo_url,
        description=recipe.description,
        servings=recipe.servings,
        prep_time_minutes=recipe.prep_time_minutes,
        cuisine=recipe.cuisine,
        diet=recipe.diet,
        ingredient_sections=[
            IngredientSectionResponse.model_validate(s) for s in recipe.ingredient_sections
        ],
        ingredients=[IngredientResponse.model_validate(i) for i in recipe.ingredients],
        steps=[StepResponse.model_validate(s) for s in recipe.steps],
    )


@router.post("/invite/{token}/claim", response_model=HandoffResponse)
def claim_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Authenticated claim: the token IS the authorization to accept, so any
    # signed-in user holding the link can claim it — this resolves the
    # mismatched-email orphan (an invite to a@x claimed by someone who signed up
    # as b@y). Idempotent: re-claiming returns the same accepted grant.
    h = db.query(Handoff).filter(Handoff.token == token).first()
    if h is None:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Already this user's grant (or an unclaimed one) → accept it in place.
    if h.to_user_id is None or h.to_user_id == current_user.id:
        h.to_user_id = current_user.id
        h.state = "accepted"
        db.commit()
        db.refresh(h)
        return h

    # A DIFFERENT user already claimed this link. Do NOT overwrite to_user_id —
    # that silently revoked the first claimer's access (can_view matches on
    # to_user_id). Instead give this user their own grant on the same recipe, so a
    # link shared with several people works for all of them.
    mine = (
        db.query(Handoff)
        .filter(Handoff.recipe_id == h.recipe_id, Handoff.to_user_id == current_user.id)
        .first()
    )
    if mine is not None:
        if mine.state != "accepted":
            mine.state = "accepted"
            db.commit()
            db.refresh(mine)
        return mine

    grant = Handoff(
        recipe_id=h.recipe_id,
        from_user_id=h.from_user_id,
        to_user_id=current_user.id,
        to_email=None,
        state="accepted",
        note=h.note,
        token=secrets.token_urlsafe(32),
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return grant


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Viewable by the owner, by anyone if the recipe's effective visibility
    # (its root's visibility) is public, or by an accepted grantee on the root;
    # otherwise 404. Editing/deleting remains owner-only — see patch_recipe.
    recipe = (
        db.query(Recipe)
        .filter(Recipe.id == recipe_id, Recipe.deleted_at == None)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not can_view(recipe, current_user, db):
        raise HTTPException(status_code=404, detail="Recipe not found")
    _attach_growth_fields(recipe, db)
    return recipe


@router.get("/{recipe_id}/scale", response_model=RecipeResponse)
def get_scaled_recipe(
    recipe_id: int,
    servings: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Gated like get_recipe: owner, public root, or accepted grantee only.
    recipe = (
        db.query(Recipe)
        .filter(Recipe.id == recipe_id, Recipe.deleted_at == None)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not can_view(recipe, current_user, db):
        raise HTTPException(status_code=404, detail="Recipe not found")

    if recipe.servings is None:
        raise HTTPException(
            status_code=400, detail="Recipe does not have servings set - cannot scale"
        )

    multiplier = servings / recipe.servings

    # scale ingredients within sections
    scaled_sections = []
    for section in recipe.ingredient_sections:
        scaled_section_ings = [
            IngredientResponse.model_validate(scale_ingredient(ing, multiplier))
            for ing in section.ingredients
        ]
        scaled_sections.append(
            {
                "id": section.id,
                "name": section.name,
                "position": section.position,
                "ingredients": scaled_section_ings,
            }
        )

    scaled_ingredients = [
        IngredientResponse.model_validate(scale_ingredient(ing, multiplier))
        for ing in recipe.ingredients
    ]

    response_dict = {
        "id": recipe.id,
        "user_id": recipe.user_id,
        "name": recipe.name,
        "author_full_name": recipe.author_full_name,
        "cover_photo_url": recipe.cover_photo_url,
        "description": recipe.description,
        "story": recipe.story,
        "servings": servings,  # return TARGET servings, not original
        "prep_time_minutes": recipe.prep_time_minutes,
        "cuisine": recipe.cuisine,
        "diet": recipe.diet,
        "source": recipe.source,
        "notes": recipe.notes,
        "language": recipe.language,
        "created_at": recipe.created_at,
        "deleted_at": recipe.deleted_at,
        "ingredient_sections": scaled_sections,
        "ingredients": scaled_ingredients,
        "steps": [StepResponse.model_validate(s) for s in recipe.steps],
    }

    return RecipeResponse.model_validate(response_dict)


@router.patch("/{recipe_id}", response_model=RecipeResponse)
def patch_recipe(
    recipe_in: RecipeUpdate,
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = (
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id, Recipe.user_id == current_user.id, Recipe.deleted_at == None
        )
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Which child collections did the client actually send? Use the dumped
    # set to detect presence, but read the values off the Pydantic model so
    # they stay as typed objects (IngredientCreate/StepCreate), not dicts.
    sent_fields = recipe_in.model_dump(exclude_unset=True)

    sections_sent = "ingredient_sections" in sent_fields
    ingredients_sent = "ingredients" in sent_fields
    steps_sent = "steps" in sent_fields

    new_sections = recipe_in.ingredient_sections if sections_sent else None
    new_ingredients = recipe_in.ingredients if ingredients_sent else None
    new_steps = recipe_in.steps if steps_sent else None

    # Apply scalar fields only (skip the child collections handled below).
    scalar_fields = {
        k: v
        for k, v in sent_fields.items()
        if k not in ("ingredient_sections", "ingredients", "steps")
    }
    for field, value in scalar_fields.items():
        setattr(recipe, field, value)

    # Replace children only when the client provided that collection. We bulk-
    # delete existing rows by recipe_id (synchronize_session=False bypasses ORM
    # instance tracking, avoiding stale-instance conflicts with the delete-orphan
    # cascade) and re-insert fresh. IDs aren't referenced externally, so
    # reassigning them is harmless. A fresh re-query happens after commit.
    recipe_id_val = recipe.id

    if sections_sent or ingredients_sent:
        db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id_val).delete(
            synchronize_session=False
        )
        db.query(IngredientSection).filter(IngredientSection.recipe_id == recipe_id_val).delete(
            synchronize_session=False
        )
        db.flush()

        for section_in in new_sections or []:
            new_section = IngredientSection(
                recipe_id=recipe_id_val,
                name=section_in.name,
                position=section_in.position,
            )
            db.add(new_section)
            db.flush()
            for ing_in in section_in.ingredients:
                db.add(
                    Ingredient(
                        recipe_id=recipe_id_val,
                        section_id=new_section.id,
                        name=ing_in.name,
                        quantity_text=ing_in.quantity_text,
                        quantity_value=ing_in.quantity_value,
                        unit=ing_in.unit,
                        quantity_type=ing_in.quantity_type,
                        notes=ing_in.notes,
                        position=ing_in.position,
                    )
                )

        for ing_in in new_ingredients or []:
            db.add(
                Ingredient(
                    recipe_id=recipe_id_val,
                    section_id=None,
                    name=ing_in.name,
                    quantity_text=ing_in.quantity_text,
                    quantity_value=ing_in.quantity_value,
                    unit=ing_in.unit,
                    quantity_type=ing_in.quantity_type,
                    notes=ing_in.notes,
                    position=ing_in.position,
                )
            )

    if steps_sent:
        db.query(Step).filter(Step.recipe_id == recipe_id_val).delete(synchronize_session=False)
        db.flush()
        for step_in in new_steps:
            db.add(
                Step(
                    recipe_id=recipe_id_val,
                    position=step_in.position,
                    content=step_in.content,
                    section_header=step_in.section_header,
                    voice_note=step_in.voice_note,
                )
            )

    db.commit()

    # Re-fetch a clean instance with children eagerly loaded (don't refresh the
    # working instance, whose relationship collections may hold deleted rows).
    db.expire_all()
    recipe = (
        db.query(Recipe)
        .filter(Recipe.id == recipe_id_val)
        .options(
            selectinload(Recipe.ingredient_sections).selectinload(IngredientSection.ingredients),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.user),
        )
        .first()
    )
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    recipe = (
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id, Recipe.user_id == current_user.id, Recipe.deleted_at == None
        )
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe.deleted_at = datetime.now(timezone.utc)

    db.add(recipe)
    db.commit()
