from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(nullable=False)
    last_name: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    # "public" | "private" — DEFAULT private: the app's spine is the intentional
    # handoff, so a profile is closed unless the owner opens it. This does NOT gate reads
    # (item visibility is concrete — see services/sharing.py); it only picks the default
    # the create form auto-selects for a new recipe/post ("Everyone" on a public profile,
    # "Friends only" on a private one) and drives the bulk "make everything …" sweep.
    profile_visibility: Mapped[str] = mapped_column(server_default="private")
    # Cloudinary URL for the user's profile picture. NULL = no photo → the UI shows the
    # first-letter monogram (the default). Uploaded via POST /upload/avatar, set through
    # PATCH /auth/me. Shown wherever the user's name appears (feed, friends, profiles) —
    # a face beside a name is identity, not private content, so it is NOT gated by
    # profile_visibility (which still hides recipes/posts).
    photo_url: Mapped[Optional[str]] = mapped_column(nullable=True)
    # server_default lets the database generate the timestamp, more reliable
    # than app-side defaults in distributed environments
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
