from app.database import Base

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

if TYPE_CHECKING:
    from app.models.ingredient_section import IngredientSection
    from app.models.ingredient import Ingredient
    from app.models.step import Step
    from app.models.user import User


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column()
    cover_photo_url: Mapped[Optional[str]] = mapped_column(nullable=True)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    story: Mapped[Optional[str]] = mapped_column(nullable=True)
    servings: Mapped[Optional[int]] = mapped_column(nullable=True)
    prep_time_minutes: Mapped[Optional[int]] = mapped_column(nullable=True)
    cuisine: Mapped[Optional[str]] = mapped_column(nullable=True)
    diet: Mapped[Optional[str]] = mapped_column(nullable=True)
    source: Mapped[Optional[str]] = mapped_column(nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    language: Mapped[str] = mapped_column(server_default="en")
    # Who the recipe came from, as a display string ("Lola Remedios · Cebu").
    # This is the byline, and it's all that remains of the removed lineage model:
    # attribution is a fact about one recipe, not an edge in a tree.
    origin_attribution: Mapped[Optional[str]] = mapped_column(nullable=True)
    # "private" | "public" — a recipe's own, since there is no root to inherit from
    visibility: Mapped[str] = mapped_column(server_default="private")
    prompt_key: Mapped[Optional[str]] = mapped_column(nullable=True)
    prompt_answer: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    ingredient_sections: Mapped[list["IngredientSection"]] = relationship(
        "IngredientSection", back_populates="recipe", cascade="all, delete-orphan"
    )
    ingredients: Mapped[list["Ingredient"]] = relationship(
        "Ingredient",
        primaryjoin="and_(Ingredient.recipe_id==Recipe.id, Ingredient.section_id==None)",
        cascade="all, delete-orphan",
        foreign_keys="[Ingredient.recipe_id]",
    )
    steps: Mapped[list["Step"]] = relationship(
        "Step", back_populates="recipe", cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship("User")

    @property
    def author_full_name(self) -> str:
        return f"{self.user.first_name} {self.user.last_name}"
