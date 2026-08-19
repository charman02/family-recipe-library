from datetime import datetime
from typing import Annotated, Optional
from pydantic import BaseModel, Field, ConfigDict, StringConstraints


# Strip first, then require a character — so "" and "   " fail by the same rule
# (min_length alone would let a spaces-only name through, which the router then
# strips to empty). Same strip-then-validate pattern as PersonName in schemas/user.
DishName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]


class PostCreate(BaseModel):
    photo_url: str = Field(min_length=1)
    # The dish name is required — a photo with no name is a picture, not "what I
    # made". Bounded so it stays a name, not a caption.
    dish_name: DishName
    description: Optional[str] = Field(default=None, max_length=500)
    # Optionally attach an existing recipe the caller owns. Ownership is enforced
    # in the router; a post never links a recipe that isn't yours.
    recipe_id: Optional[int] = None


class PostResponse(BaseModel):
    """A post as the feed/profile renders it: the meal, plus who made it (name +
    id, never email). recipe_id is exposed so the card can link through when the
    post has a recipe attached."""

    id: int
    user_id: int
    author_first_name: str
    author_last_name: str
    photo_url: str
    dish_name: str
    description: Optional[str] = None
    recipe_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
