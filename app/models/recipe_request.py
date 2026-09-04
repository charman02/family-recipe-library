from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class RecipeRequest(Base):
    """Someone asked the cook for the recipe behind a shared meal (#79).

    This is the app's premise as a mechanic: you tasted something and asked for it. A
    request is a COSTLY, SPECIFIC ask that ends in a real artifact — a recipe handed over —
    which is why it is not a like. Guardrails that keep it from becoming one:

    - **The count is the cook's, not the public's.** `request_count` is returned only to the
      post's author. Everyone else learns only whether *they themselves* asked. A public
      "N people want this" tally is a like count with a different noun, and it would put a
      visible zero under the ordinary Tuesday meal this app exists to make postable. Demand
      gets surfaced later by RANK instead (a "most asked for" row in Browse), which shows
      the dishes that have demand without ever rendering an absence.
    - **No list of who asked, to anyone but the cook.** Same reasoning as the removed
      keeper-count: a reader-facing tally of interest is the `child_count` this codebase
      already deleted once.
    - **Asking never reveals anything.** The client offers the button whenever the VIEWER
      cannot read a recipe for the post — which is the same state whether the cook never
      wrote one or wrote one and kept it private, because the post response nulls
      `recipe_id` for a recipe you may not read. So the button carries no information, and
      no copy anywhere says "the cook wrote this but didn't share it".

    Fulfilling mints an accepted `Handoff` grant per requester (see `fulfill_post`), which
    is why a private recipe can be delivered without changing its visibility: the grant is
    orthogonal to `visibility` in `can_view`, exactly as a hand-off has always been.

    `state`: 'pending' | 'fulfilled'. Unique on (post_id, requester_id) so asking twice is
    idempotent rather than a second row — the same shape as the friendship pair constraint.
    """

    __tablename__ = "recipe_requests"
    __table_args__ = (
        # Inline, not an ALTER: SQLite has no ADD CONSTRAINT, and the migration chain has to
        # replay there.
        UniqueConstraint("post_id", "requester_id", name="uq_recipe_request_post_requester"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    state: Mapped[str] = mapped_column(server_default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
