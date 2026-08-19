from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Post(Base):
    """A meal someone cooked, shared to their friends — the presence feed's unit.

    A post is deliberately LIGHT: a photo, the dish's name, and an optional line.
    It is NOT a recipe and carries no ingredients/steps. The point is showing what
    you made without the obligation to log it. `recipe_id` is nullable on purpose —
    a post may never have a recipe (just the moment), get one later (when friends
    ask for it — Phase 2's request loop), or reference one you already keep. The
    three fields (dish_name, description, photo_url) are exactly what seed a recipe
    if the poster later chooses to make one, so nothing is re-entered.

    SET NULL on recipe_id: deleting the linked recipe leaves the post standing (the
    meal still happened); the post just loses its link.
    """

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    photo_url: Mapped[str] = mapped_column(nullable=False)
    dish_name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # "public" | "friends" | "private" — CONCRETE, same three values and the same rule
    # as Recipe.visibility (services/sharing.can_view_post):
    #   public  → anyone (eligible for the everyone-feed / Browse).
    #   friends → the author's accepted friends only.
    #   private → only the author.
    # The literal stored value, not a pointer to the profile. server_default "friends"
    # so a bypassing insert is closed to friends, never accidentally public.
    visibility: Mapped[str] = mapped_column(server_default="friends")
    recipe_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
    # The author — needed by can_view_post to read the owner's profile_visibility.
    user: Mapped["User"] = relationship("User")
