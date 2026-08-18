from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


class FriendRequestIn(BaseModel):
    to_user_id: int


class FriendResponse(BaseModel):
    """A friendship row as the client needs it: who the OTHER person is (name +
    id, never email), plus state and which way the request went so the UI can show
    'accept' only to the addressee of a pending request."""

    id: int
    state: Literal["pending", "accepted"]
    # The other user in the pair, from the caller's perspective.
    user_id: int
    first_name: str
    last_name: str
    # True when the CALLER sent this request (so a pending one they sent shows
    # "Requested", not an accept button). Set by the router per-caller.
    outgoing: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FriendSuggestion(BaseModel):
    """A person to suggest friending, drawn from the handoff graph (someone the
    caller handed a recipe to, or received one from) who isn't already a friend or
    a pending request."""

    user_id: int
    first_name: str
    last_name: str
    # Why they're suggested — 'sent' (you handed them a recipe) or 'received'
    # (they handed you one). Lets the UI say "you cooked for them" / "cooked for you".
    reason: Literal["sent", "received"]


class ProfileResponse(BaseModel):
    """Another user's public-facing profile: their name and the recipes of theirs
    the caller may see (public for now; the friends tier arrives with the
    visibility change). `friend_state` tells the UI which button to show."""

    user_id: int
    first_name: str
    last_name: str
    # None = no relationship; else the friendship state, plus whether the caller
    # is the one who'd need to accept a pending request.
    friend_state: Optional[Literal["pending", "accepted"]] = None
    friend_can_accept: bool = False
    recipe_count: int = 0
