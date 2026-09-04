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

    Carries only what a row needs to be tappable and actionable: name, id, photo, and the
    caller's own relationship to this person. No email (that would make the directory a
    harvestable address book), no counts, no activity.

    `friend_state` is the caller's side of the relationship, so the row can show the right
    control instead of the person vanishing:
      - `none`      — no relationship; offer "Add"
      - `requested` — the CALLER asked them; show "Requested", not a live Add button

    Who is NOT in this list, and why it's the same rule twice: an accepted friend (they're in
    `GET /friends`), someone whose request is pending TOWARDS the caller (they're in
    `GET /friends/requests`, which the Friends page already renders above this section with
    Accept/Ignore — listing them here as well put one request on screen twice with two live
    Accept buttons), and anyone in a block relationship. Only the caller's own OUTGOING pending
    request keeps someone here, because that is the case that had no other home and where
    disappearing read as "did that work, or did I just remove them?".
    """

    user_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    friend_state: Literal["none", "requested"] = "none"


class BlockRequestIn(BaseModel):
    user_id: int


class BlockedPerson(BaseModel):
    """Someone the CALLER has blocked, for their own unblock list (#85).

    Only ever people the caller blocked — never who has blocked the caller, which is
    information they aren't entitled to and would defeat blocking as protection.
    """

    user_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    created_at: datetime


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
