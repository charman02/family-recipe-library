from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Feedback(Base):
    """A note a signed-in person sent about the app itself.

    Replaces the external hosted form the launch shipped (VITE_FEEDBACK_URL). Two
    things made that form lose reports: leaving the app to fill one in is where
    most people gave up, and an answer arrived as anonymous prose — no account, no
    build — so acting on "the button didn't work" meant finding the sender and
    interrogating them.

    What this captures beyond the words is chosen to close exactly that gap and
    stop there. Nothing here would surprise a beta tester reading a privacy note,
    because the form says out loud what it sends.
    """

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    # CASCADE, matching handoffs/cook_events. There is no delete-my-account path
    # yet, but when one lands this is the behaviour to want: the words a person
    # wrote about the app go with the account that wrote them, rather than
    # outliving a request to be forgotten.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Text, not String: a real bug report runs to paragraphs, and the only bound
    # that should apply is the deliberate one in the schema (2000 chars) rather
    # than an incidental column width.
    body: Mapped[str] = mapped_column(Text)
    # The in-app route the sender was on when they opened the form, supplied by
    # the entry point. Nullable and deliberately NOT derived from anything the
    # sender can't see — it's a screen they navigated to themselves, and the form
    # tells them it's included.
    #
    # LIMITATION, stated rather than hidden: the only entry point today is the You
    # screen, so most beta reports will carry "/profile". The column is here
    # because it costs one nullable field now and cannot be backfilled later — the
    # moment a contextual entry point exists (a "something's wrong here" link on a
    # recipe or an error state), every report from then on is self-locating.
    path: Mapped[Optional[str]] = mapped_column(nullable=True)
    # Which build the sender was running, from VITE_APP_VERSION. Nullable because
    # an unset env var must not turn into a fake version string. This is the field
    # that prevents the most common wasted exchange in a beta: a bug that was
    # already fixed in a deploy the sender hadn't loaded yet.
    app_version: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # DELIBERATELY NOT CAPTURED, all for the same reason — a beta this small can
    # just ask, and none of it is worth the cost of collecting it silently:
    #   · user agent / OS / device / screen size. The classic "helpful" field and
    #     the one that turns this table into a fingerprint: a UA string plus an
    #     account plus a timestamp identifies a device, and collecting it honestly
    #     would need a disclosure longer than the form.
    #   · IP address. Approximates where someone lives; never worth it for a bug.
    #   · Console logs, network traces, automatic screenshots. These scoop up
    #     whatever happened to be on screen — other people's recipes, a half-typed
    #     message — which is precisely the surprise a privacy note has to avoid.
    #   · The sender's email. Already reachable through user_id; asking again is
    #     friction for a fact we hold.
