from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Block(Base):
    """One person has blocked another (#85).

    The ROW is directional (who blocked whom, which is what an unblock list needs) but the
    EFFECT is symmetric: a block in either direction makes the pair mutually invisible. One-way
    blocking doesn't work in practice — you'd keep meeting their meals in Browse, which is the
    exact thing you blocked them to stop. See `services/blocks.is_blocked`.

    What a block does, decided 2026-09-04:
    - **Mutual invisibility.** Neither appears to the other in the people directory, Browse, the
      everyone-feed, or on each other's profile. Enforced in `_resource_is_visible` (so it
      covers every recipe and post read through the two read rules) plus the handful of list
      endpoints that don't go through them.
    - **The friendship is deleted**, not suspended. You can't be friends with someone you've
      blocked, and a dormant `accepted` row would leave friends-only content readable until
      something else noticed. Unblocking does NOT restore it — they'd have to ask again.
    - **An accepted handoff grant SURVIVES.** You genuinely gave them that recipe; it's on
      their Kept shelf and they may have cooked from it. A block means "no new contact", not
      "unsend", and revoking would be the only place in the app where access is taken back
      after being given. So `can_view`'s grant branch stays open to a blocked user for that
      one recipe — deliberately, and pinned by a test.
    - **Silent.** Every denial stays a 404, never a 403, exactly like the rest of the app: a
      blocked user must not be able to detect the block from a response code.

    Unique on the ordered pair, so blocking twice is idempotent rather than a second row. Two
    rows CAN exist for one pair (A blocks B, B blocks A) — that's fine and meaningful; either
    is enough for the effect, and unblocking only removes your own.
    """

    __tablename__ = "blocks"
    __table_args__ = (
        # Inline, not an ALTER: SQLite has no ADD CONSTRAINT and this chain replays there.
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    blocker_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    blocked_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
