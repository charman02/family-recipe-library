from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Notification(Base):
    """One thing that happened, addressed to one person (#79).

    issei had no notification surface at all before this, and the recipe-request loop needs
    one on both ends: the cook has to learn someone asked, and the requester has to learn the
    recipe arrived. A generic row rather than a per-feature counter, so friend requests,
    accepts, fulfilments and any later act route through ONE inbox — and so the same rows
    become push payloads when the native app lands, instead of being rebuilt then.

    Everything is created through `services/notifications.py::notify()`. Nothing else in the
    codebase should construct this directly; one producer means one place to get the
    self-notify guard, the type vocabulary and the ordering right.

    `type` is a plain string, deliberately not a DB enum: SQLite has no native enum and
    Postgres enums need a migration to add a value, which is friction on a vocabulary that
    will grow. The set is documented in `NOTIFICATION_TYPES` and validated at the service.

    Reference columns are all nullable with `ondelete="SET NULL"`: a notification about a
    post that was later deleted should degrade to an un-clickable line, not vanish (the fact
    that someone asked still happened) and not break a foreign key. `user_id` and `actor_id`
    CASCADE — if either party deletes their account, the row has no one to show or to name.

    `read_at` is nullable; NULL means unread. Read is per-row and idempotent, and the unread
    count is derived rather than stored, so there is no counter to drift out of sync.
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The RECIPIENT. Every query is scoped to this, and it is never the actor.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(nullable=False)
    # Who caused it. Nullable so a system-generated notice is possible later.
    actor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    post_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"), nullable=True
    )
    recipe_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
