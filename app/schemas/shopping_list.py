from typing import Optional
from pydantic import BaseModel, Field


# Shopping list schemas


class ShoppingListRequest(BaseModel):
    # At least one recipe: a shopping list for nothing is a caller bug, and answering
    # it with an empty 200 hides that bug behind a plausible-looking response.
    recipe_ids: list[int] = Field(min_length=1)


class ShoppingListItem(BaseModel):
    name: str
    quantity_text: str
    quantity_value: Optional[float] = None
    unit: Optional[str] = None
    quantity_type: str
    breakdown: str


class ShoppingListResponse(BaseModel):
    items: list[ShoppingListItem]
