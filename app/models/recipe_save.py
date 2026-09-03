from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class RecipeSave(Base):
    """A bookmark: this person keeps this recipe (#57).

    It is a POINTER, not a copy. There is exactly one Recipe row for a dish — the
    cook's — and keeping it stores only who kept what, so:

    - the byline still reads "from Lola" because it is still Lola's recipe;
    - the cook's later correction ("1 tsp, not 1 tbsp") reaches every keeper, which
      matters here because the amounts ARE the product;
    - if the cook restricts or deletes the recipe, access genuinely ends — every read
      re-asks `can_view`, so nothing is frozen behind the owner's back.

    WHAT THIS TABLE IS NOT — the guardrails, because #57 sits one design decision away
    from features this project deliberately deleted (lineage in 8a3b734, Remix entirely):

    - It carries ONE recipe FK. No row in this schema may reference two recipes: a
      second one ("this recipe came FROM that recipe") is `parent_recipe_id` renamed,
      which is the lineage substrate POSITIONING forbids.
    - No kind/relation column ('saved' | 'copy' | 'original'). That is `lineage_relation`,
      whose removed enum literally contained "kept".
    - No keeper counts are ever exposed on a recipe, a card, or a profile. "12 people
      keep this" is `child_count` restored, and it is a like button with a new noun.
      Counting your OWN shelf is fine.
    - Nothing here may be consulted by `can_view`. This row is created by the READER,
      so treating it as an authorization fact would let anyone self-grant read on a
      private recipe by bookmarking it. That is why `app/services/sharing.py` must
      never import this model — the handoff grant is authoritative only because the
      OWNER creates it. Keeping is a shelf, not a permission.

    CASCADE on both FKs: the bookmark is meaningless without either side, and deleting
    a recipe or an account should not leave a dangling shelf entry. UNIQUE(user_id,
    recipe_id) makes keeping idempotent — a double tap cannot create two rows.
    """

    __tablename__ = "recipe_saves"
    __table_args__ = (UniqueConstraint("user_id", "recipe_id", name="uq_recipe_save_user_recipe"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
