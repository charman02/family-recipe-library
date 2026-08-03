from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class OriginIn(BaseModel):
    name: str
    place: Optional[str] = None
    year: Optional[str] = None
    memory: Optional[str] = None


# Step schemas


class StepCreate(BaseModel):
    position: int
    content: str
    section_header: Optional[str] = None
    voice_note: Optional[str] = None
    # An already-uploaded photo for this step (POST /upload/recipe-photo returns
    # the URL). Same contract as the recipe's cover_photo_url: the client uploads
    # first and sends back a URL, so recipe writes stay JSON.
    photo_url: Optional[str] = None


class StepResponse(BaseModel):
    id: int
    position: int
    content: str
    section_header: Optional[str] = None
    voice_note: Optional[str] = None
    photo_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Ingredient schemas


class IngredientCreate(BaseModel):
    name: str
    quantity_text: Optional[str] = None
    quantity_value: Optional[float] = None
    unit: Optional[str] = None
    quantity_type: str = "precise"
    notes: Optional[str] = None
    position: int


class IngredientResponse(BaseModel):
    id: int
    name: str
    quantity_text: Optional[str] = None
    quantity_value: Optional[float] = None
    unit: Optional[str] = None
    quantity_type: str
    notes: Optional[str] = None
    position: int
    # Only set by the scale endpoint, and only when an amount was deliberately
    # NOT scaled (a folk unit that would land on a fraction, or a non-linear
    # measure like "3 fingers of water"). Carries the multiplier — e.g. "×2.5" —
    # so the UI can show the cook's own words plus what to adjust by feel.
    scale_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IngredientSuggestions(BaseModel):
    # The signed-in user's OWN ingredient vocabulary, most-used first, for the
    # add-recipe autosuggest. An object rather than a bare array so this can grow
    # a field (counts, a remembered unit) without a breaking response shape.
    names: list[str] = []


# IngredientSection schemas


class IngredientSectionCreate(BaseModel):
    name: str
    position: int
    ingredients: list[IngredientCreate] = []


class IngredientSectionResponse(BaseModel):
    id: int
    name: str
    position: int
    ingredients: list[IngredientResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Recipe schemas


class RecipeCreate(BaseModel):
    name: str
    cover_photo_url: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cuisine: Optional[str] = None
    diet: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    language: str = "en"
    visibility: Literal["private", "public"] = "private"
    ingredient_sections: list[IngredientSectionCreate] = []
    ingredients: list[IngredientCreate] = []
    steps: list[StepCreate] = []
    origin: Optional[OriginIn] = None


class CookIn(BaseModel):
    photo_url: Optional[str] = None
    note: Optional[str] = None


class RecipeResponse(BaseModel):
    id: int
    user_id: int
    name: str
    author_full_name: Optional[str] = None
    cover_photo_url: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cuisine: Optional[str] = None
    diet: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    language: str
    cook_count: int = 0
    owner_cook_count: int = 0
    shared_with_count: int = 0
    growth_stage: str = "seed"
    growth_vitality: str = "bare"
    soul_count: int = 0
    last_cooked_at: Optional[datetime] = None
    visibility: str = "private"
    origin_attribution: Optional[str] = None
    prompt_key: Optional[str] = None
    prompt_answer: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
    ingredient_sections: list[IngredientSectionResponse] = []
    ingredients: list[IngredientResponse] = []
    steps: list[StepResponse] = []

    model_config = ConfigDict(from_attributes=True)


class HandoffIn(BaseModel):
    # A recipient is OPTIONAL. With neither field the handoff is "link-only": it
    # mints a token the sender shares however they already talk to that person
    # (share sheet / iMessage / etc.) — the fastest way to pass a recipe on.
    # Supplying to_email additionally enables auto-accept when that address signs
    # up; to_user_id grants an existing user access instantly.
    to_email: Optional[str] = None
    to_user_id: Optional[int] = None
    note: Optional[str] = None


class HandoffResponse(BaseModel):
    id: int
    recipe_id: int
    state: str
    to_email: Optional[str] = None
    to_user_id: Optional[int] = None
    note: Optional[str] = None
    token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvitePreview(BaseModel):
    # The recipient's view of a handed-off recipe, readable WITHOUT an account.
    #
    # This used to be a soft wall (name/story/photo only) that made the recipient
    # sign up before reading the ingredients. That inverted the whole point: the
    # person on the other end of a handoff has never tasted the dish and wants to
    # COOK it, so gating the body is friction at the moment of highest intent.
    # The token is the capability; holding the link IS the permission to read.
    #
    # Still deliberately NOT exposed — the recipient gets the dish, not the
    # account: the owner's private `notes` scratchpad, user_id/author ids, and
    # anything else that isn't the recipe as cooked. Signing up is what unlocks
    # keeping, cooking, and adding to it.
    recipe_id: int
    name: str
    from_name: Optional[str] = None
    origin_attribution: Optional[str] = None
    story: Optional[str] = None
    growth_stage: str = "seed"
    growth_vitality: str = "bare"
    cover_photo_url: Optional[str] = None
    description: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cuisine: Optional[str] = None
    diet: Optional[str] = None
    ingredient_sections: list[IngredientSectionResponse] = []
    ingredients: list[IngredientResponse] = []
    steps: list[StepResponse] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    cover_photo_url: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cuisine: Optional[str] = None
    diet: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = None
    visibility: Optional[Literal["private", "public"]] = None
    # When provided, these fully replace the recipe's existing children.
    # Omit them to leave the collections untouched (scalar-only update).
    ingredient_sections: Optional[list[IngredientSectionCreate]] = None
    ingredients: Optional[list[IngredientCreate]] = None
    steps: Optional[list[StepCreate]] = None
