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
    # The other person's profile picture (or None → monogram), so the friends list shows
    # faces. Set by the router from the resolved user.
    photo_url: Optional[str] = None
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
    photo_url: Optional[str] = None
    # Why they're suggested — 'sent' (you handed them a recipe) or 'received'
    # (they handed you one). Lets the UI say "you cooked for them" / "cooked for you".
    reason: Literal["sent", "received"]


class DiscoverPerson(BaseModel):
    """Someone you could add, from the app-wide directory (#80).

    Deliberately NOT `FriendSuggestion`: a suggestion carries a `reason` ("you sent them
    a recipe"), which is the whole point of that list. Directory entries have no reason —
    they are simply other people using issei — and inventing one would be a lie.

    Carries only what a row needs to be tappable: name, id, photo. No email (that would
    make the directory a harvestable address book), no counts, no activity.
    """

    user_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None


class ProfileResponse(BaseModel):
    """Another user's public-facing profile: their name and a count of the recipes and
    posts of theirs the caller may see (per the profile-visibility model — public if
    the target's profile is public, friends-visible if the caller is a friend, plus any
    force-public items). `friend_state` tells the UI which button to show."""

    user_id: int
    first_name: str
    last_name: str
    # The target's profile picture (or None → monogram) for the profile header.
    photo_url: Optional[str] = None
    # The target's profile visibility, so the UI can label a private profile.
    profile_visibility: str = "private"
    # None = no relationship; else the friendship state, plus whether the caller
    # is the one who'd need to accept a pending request.
    friend_state: Optional[Literal["pending", "accepted"]] = None
    friend_can_accept: bool = False
    recipe_count: int = 0
    post_count: int = 0
    # The target's accepted-friend count. Not gated — a friend count is a public,
    # symmetric fact (unlike recipe/post counts, which are what the CALLER may see).
    # Powers the "You" page's identity-box counts (own profile) and any profile header.
    friend_count: int = 0
