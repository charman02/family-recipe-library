from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Friendship(Base):
    """A symmetric friendship between two users, BeReal-style: both must accept.

    Direction is stored (who sent the request vs. who received it) because it's
    load-bearing for authorization — only the *addressee* may accept a pending
    request — but the RELATION it represents is undirected: once `accepted`, the two
    are friends regardless of who asked. The single source of truth for "are these
    two friends?" is `app.services.friends.are_friends`; don't re-derive it.

    ONE ROW PER UNORDERED PAIR, enforced at the DB by a unique constraint on the
    *normalized* pair (pair_low, pair_high) = (min, max) of the two ids — NOT on the
    directional (requester, addressee), because that lets a reverse race (A→B and
    B→A inserting concurrently) create two rows for the same pair. The normalized
    columns are set on every insert (see `set_pair`); a losing concurrent insert
    hits this constraint and the router catches it and returns the winner's row.
    state: 'pending' | 'accepted'.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("pair_low", "pair_high", name="uq_friendship_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    addressee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # The unordered pair, always (smaller_id, larger_id). Direction lives in
    # requester/addressee (it decides who may accept); these exist only to make the
    # "one friendship per pair" rule enforceable by the database, race and all.
    pair_low: Mapped[int] = mapped_column(index=True)
    pair_high: Mapped[int] = mapped_column(index=True)
    state: Mapped[str] = mapped_column(server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    def set_pair(self):
        """Set pair_low/pair_high from requester/addressee. Call before insert."""
        a, b = self.requester_id, self.addressee_id
        self.pair_low, self.pair_high = (a, b) if a <= b else (b, a)
