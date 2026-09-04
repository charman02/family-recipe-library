from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.post import Post
from app.models.handoff import Handoff
from app.models.friendship import Friendship
from app.schemas.friend import (
    DiscoverPerson,
    FriendRequestIn,
    FriendResponse,
    FriendSuggestion,
    ProfileResponse,
)
from app.services.friends import existing_friendship, friend_ids
from app.services.notifications import notify
from app.services.sharing import can_view, can_view_post

router = APIRouter(prefix="/friends", tags=["friends"])

# Cap on the app-wide directory (GET /friends/discover). Generous at today's scale and a
# hard ceiling on the response either way; the search box is what makes a longer list
# navigable, so this never needs to grow into "return everyone".
DISCOVER_LIMIT = 50


def _to_friend_response(f: Friendship, me_id: int, users_by_id: dict) -> FriendResponse:
    """Render a Friendship from the caller's perspective: the OTHER person, and
    whether the caller sent it (so a pending outgoing request shows 'Requested'
    rather than an accept button)."""
    other_id = f.addressee_id if f.requester_id == me_id else f.requester_id
    u = users_by_id[other_id]
    return FriendResponse(
        id=f.id,
        state=f.state,
        user_id=other_id,
        first_name=u.first_name,
        last_name=u.last_name,
        photo_url=u.photo_url,
        outgoing=f.requester_id == me_id,
        created_at=f.created_at,
    )


def _users_by_id(ids, db):
    if not ids:
        return {}
    rows = db.query(User).filter(User.id.in_(set(ids))).all()
    return {u.id: u for u in rows}


@router.post("/request", response_model=FriendResponse, status_code=status.HTTP_201_CREATED)
def request_friend(
    body: FriendRequestIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a friend request. Idempotent-ish and safe against races:
    - can't friend yourself,
    - if a row already exists in EITHER direction, return it (a reverse-direction
      pending request from the other person is effectively accepted by requesting
      back — mirrors how a mutual intent should resolve),
    - target must exist.
    """
    if body.to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can’t friend yourself.")
    target = db.query(User).filter(User.id == body.to_user_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = existing_friendship(current_user.id, body.to_user_id, db)
    if existing is not None:
        # A reverse pending request already waiting from them → requesting back
        # accepts it, so both intents are honoured without a second row.
        if existing.state == "pending" and existing.addressee_id == current_user.id:
            existing.state = "accepted"
            # Requesting back is an accept, so the original requester hears the same thing
            # they'd hear from the accept endpoint (#79's one inbox).
            notify(
                db,
                user_id=existing.requester_id,
                type="friend_accept",
                actor_id=current_user.id,
            )
            db.commit()
            db.refresh(existing)
        return _to_friend_response(
            existing, current_user.id, _users_by_id([current_user.id, body.to_user_id], db)
        )

    f = Friendship(
        requester_id=current_user.id, addressee_id=body.to_user_id, state="pending"
    )
    f.set_pair()
    db.add(f)
    notify(db, user_id=body.to_user_id, type="friend_request", actor_id=current_user.id)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request for the same unordered pair won the race and tripped
        # uq_friendship_pair. Roll back and return whichever row exists now, so a
        # double-tap or a simultaneous reverse request resolves to one friendship
        # instead of a 500 or a duplicate. (The DB constraint is the real guard;
        # the earlier existing_friendship check just avoids the round-trip.)
        db.rollback()
        winner = existing_friendship(current_user.id, body.to_user_id, db)
        if winner is None:
            raise  # genuinely unexpected — don't swallow it
        return _to_friend_response(
            winner, current_user.id, _users_by_id([current_user.id, body.to_user_id], db)
        )
    db.refresh(f)
    return _to_friend_response(
        f, current_user.id, _users_by_id([current_user.id, body.to_user_id], db)
    )


@router.post("/{friendship_id}/accept", response_model=FriendResponse)
def accept_friend(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a pending request. ONLY the addressee may accept — the requester
    accepting their own request would be a self-grant."""
    f = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if f is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if f.addressee_id != current_user.id:
        # 404 not 403 — don't reveal a request exists to someone not party to it.
        raise HTTPException(status_code=404, detail="Request not found")
    if f.state != "accepted":
        f.state = "accepted"
        notify(db, user_id=f.requester_id, type="friend_accept", actor_id=current_user.id)
        db.commit()
        db.refresh(f)
    return _to_friend_response(
        f, current_user.id, _users_by_id([f.requester_id, f.addressee_id], db)
    )


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unfriend, decline a request, or cancel one you sent. Either party may do it;
    a non-party gets a 404 (can't probe for others' friendships)."""
    f = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if f is None:
        raise HTTPException(status_code=404, detail="Not found")
    if current_user.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(f)
    db.commit()
    return None


@router.get("", response_model=list[FriendResponse])
def list_friends(
    order: Literal["recent", "active"] = Query(
        default="recent",
        description="'recent' (default) = newest friendship first, for the Friends "
        "management page. 'active' = friends who posted most recently first (the Feed's "
        "presence strip); friends with no visible post fall back to friendship recency.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caller's ACCEPTED friends.

    Two orderings, same rows. `recent` sorts by when the friendship formed (what the
    Friends page has always shown). `active` sorts by each friend's most recent VISIBLE
    post, so the Feed's avatar strip surfaces who's been cooking lately (#75).

    Privacy — enforced here at the query layer, not the UI: the activity scan counts only
    posts with `visibility != 'private'`. Every row is an ACCEPTED friend, and for an
    accepted friend that is exactly what `can_view_post` permits (their public + friends
    posts, never their private ones). So a friend's private post can never move them up
    the caller's strip — which would itself leak that a hidden post exists. This endpoint
    stays a re-presentation of friendships the caller is already party to; no post content
    or count is returned, only the sort changes."""
    rows = (
        db.query(Friendship)
        .filter(
            Friendship.state == "accepted",
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            ),
        )
        .order_by(Friendship.created_at.desc())
        .all()
    )
    ids = [f.addressee_id if f.requester_id == current_user.id else f.requester_id for f in rows]
    users = _users_by_id(ids, db)

    if order == "active" and ids:
        # Each friend's latest visible post, keyed by MAX(Post.id) not MAX(created_at):
        # ids are monotonic and posts are never backdated, so the largest id IS the most
        # recent post (the same reasoning the feed's keyset pagination relies on), and it
        # comes back as a plain int on both SQLite and Postgres — no aggregate-over-
        # datetime dialect surprises. `visibility != 'private'` is the read-authorization
        # filter (see the docstring); a friend with no visible post isn't in this map.
        latest = dict(
            db.query(Post.user_id, func.max(Post.id))
            .filter(
                Post.user_id.in_(ids),
                Post.visibility != "private",
            )
            .group_by(Post.user_id)
            .all()
        )
        # Sort friends by (has a visible post, then how recent it is) — both descending —
        # so recent posters lead and quiet friends keep their friendship-recency order
        # behind them. `rows` is already friendship-newest-first, and Python's sort is
        # stable, so friends who tie on activity (e.g. all the never-posted ones at 0)
        # preserve that original order for free.
        rows = sorted(
            rows,
            key=lambda f: latest.get(
                f.addressee_id if f.requester_id == current_user.id else f.requester_id,
                0,
            ),
            reverse=True,
        )

    return [_to_friend_response(f, current_user.id, users) for f in rows]


@router.get("/requests", response_model=list[FriendResponse])
def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pending requests addressed TO the caller — the ones they can accept."""
    rows = (
        db.query(Friendship)
        .filter(
            Friendship.state == "pending",
            Friendship.addressee_id == current_user.id,
        )
        .order_by(Friendship.created_at.desc())
        .all()
    )
    users = _users_by_id([f.requester_id for f in rows], db)
    return [_to_friend_response(f, current_user.id, users) for f in rows]


@router.get("/suggestions", response_model=list[FriendSuggestion])
def friend_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """People to suggest friending, drawn from the HANDOFF GRAPH — anyone the caller
    handed a recipe to (accepted handoff, to_user_id set) or received one from — who
    isn't already a friend or in a pending request with them. This is the cold-start
    seed: the people you've exchanged recipes with are a real trust graph. Nobody
    else is suggested (no stranger discovery)."""
    # Recipes I own, handed to someone (I → them).
    sent_rows = (
        db.query(Handoff.to_user_id)
        .join(Recipe, Recipe.id == Handoff.recipe_id)
        .filter(
            Recipe.user_id == current_user.id,
            Handoff.to_user_id.isnot(None),
            Handoff.to_user_id != current_user.id,
            Handoff.state == "accepted",
        )
        .all()
    )
    # Recipes handed TO me by their owner (them → I).
    received_rows = (
        db.query(Handoff.from_user_id)
        .filter(
            Handoff.to_user_id == current_user.id,
            Handoff.from_user_id != current_user.id,
            Handoff.state == "accepted",
        )
        .all()
    )

    # Reason: 'sent' takes precedence if both (you cooked for them AND vice versa).
    reason_by_id: dict[int, str] = {}
    for (uid,) in received_rows:
        reason_by_id.setdefault(uid, "received")
    for (uid,) in sent_rows:
        reason_by_id[uid] = "sent"

    # Drop anyone already a friend or in a pending request (either direction).
    existing = (
        db.query(Friendship.requester_id, Friendship.addressee_id)
        .filter(
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            )
        )
        .all()
    )
    entangled = set()
    for r_id, a_id in existing:
        entangled.add(a_id if r_id == current_user.id else r_id)

    candidate_ids = [uid for uid in reason_by_id if uid not in entangled]
    users = _users_by_id(candidate_ids, db)
    out = []
    for uid in candidate_ids:
        u = users.get(uid)
        if u is None:
            continue
        out.append(
            FriendSuggestion(
                user_id=uid,
                first_name=u.first_name,
                last_name=u.last_name,
                photo_url=u.photo_url,
                reason=reason_by_id[uid],
            )
        )
    return out


@router.get("/discover", response_model=list[DiscoverPerson])
def discover_people(
    q: str | None = Query(
        default=None,
        # 80 = UserCreate's name ceiling, so a term longer than the longest storable name
        # can never match anything. Validated at the boundary like `order` on GET /friends.
        max_length=80,
        description="Optional name search (case-insensitive, matches first or last name).",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Everyone else on issei, so a new user can actually find someone (#80).

    Reported by a real user: she couldn't work out how to find people. Before this the
    only routes to a friend were the feed's "everyone" tab or somebody having handed you
    a recipe, and `/friends/suggestions` — the "People you've shared recipes with" list —
    is seeded purely from the handoff graph, so a user with no handoffs was shown nothing
    at all. A directory is the blunt fix that works at this scale.

    WHAT THIS DISCLOSES, stated plainly: a first name, last name and photo, to any signed
    -in user. That is not new information — the same three already appear on posts, on
    recipe bylines, on `/u/{id}`, and on `GET /friends/profile/{id}`, all of which any
    signed-in user can already reach. What IS new is that they become ENUMERABLE: you no
    longer need to know an id to see who exists. That was an explicit owner decision, with
    no opt-out for now.

    Deliberately NOT gated on `profile_visibility`. That field is `private` by DEFAULT and
    #68 established it is never consulted at read time; using it here would both break
    that rule and leave the directory empty, fixing nothing. If an opt-out is ever wanted
    it needs its own column.

    Excludes yourself, your accepted friends, and anyone with a pending request in either
    direction — for all of whom an "Add" button would be wrong or a no-op. Newest accounts
    first (the people most likely to be looking for someone too), capped.

    Declared BEFORE /profile/{user_id} so the literal path isn't captured as a user id.
    """
    # Anyone already entangled with the caller — friend or pending, either direction.
    entangled = {current_user.id}
    for r_id, a_id in db.query(Friendship.requester_id, Friendship.addressee_id).filter(
        or_(
            Friendship.requester_id == current_user.id,
            Friendship.addressee_id == current_user.id,
        )
    ):
        entangled.add(a_id if r_id == current_user.id else r_id)

    query = db.query(User).filter(User.id.notin_(entangled))
    if q and q.strip():
        # Match either name part, so "ana" finds "Ana Cruz" and "Cruz" does too. ilike is
        # the portable case-insensitive contains (SQLite LIKE is already case-insensitive
        # for ASCII; Postgres ilike is explicitly so). Email is NOT searchable — letting
        # anyone probe addresses would turn the directory into an address-book oracle.
        #
        # The user's text is ESCAPED before it becomes a LIKE pattern: unescaped, a typed
        # `%` or `_` would be read as a wildcard, so searching for someone whose name has
        # an underscore silently matches any single character, and a lone `%` reads as
        # "everyone". This is a correctness fix, not an injection one — the value is still
        # a bound parameter either way, so nothing here is interpolated into SQL.
        term = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                User.first_name.ilike(pattern, escape="\\"),
                User.last_name.ilike(pattern, escape="\\"),
            )
        )
    people = query.order_by(User.created_at.desc(), User.id.desc()).limit(DISCOVER_LIMIT).all()
    return [
        DiscoverPerson(
            user_id=u.id, first_name=u.first_name, last_name=u.last_name, photo_url=u.photo_url
        )
        for u in people
    ]


@router.get("/profile/{user_id}", response_model=ProfileResponse)
def user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A read-only profile of another user: name, profile visibility, friendship
    status from the caller's side, and a count of their recipes + posts the caller may
    see under the profile-visibility model.

    "May see" = exactly what can_view / can_view_post allow: everything if it's your own
    profile or the target's profile is public; friends-visible items if you're friends;
    plus any item the target force-marked public. The counts deliberately never leak the
    existence of items the caller can't open."""
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    friend_state = None
    friend_can_accept = False
    if user_id != current_user.id:
        f = existing_friendship(current_user.id, user_id, db)
        if f is not None:
            friend_state = f.state
            friend_can_accept = f.state == "pending" and f.addressee_id == current_user.id

    # Visible recipe + post counts, decided by the single read rules (not a bespoke
    # query filter — one source of truth for "can see"). Two optimizations for a
    # profile that may hold many items, without forking the rule:
    #   - attach the already-loaded target as each item's `user` so the profile check
    #     reads profile_visibility with no per-item query;
    #   - the viewer↔target friendship is invariant across every item, so resolve it
    #     ONCE and pass it in (is_friend) instead of letting each can_view* re-query.
    is_friend = friend_state == "accepted"
    recipes = (
        db.query(Recipe)
        .filter(Recipe.user_id == user_id, Recipe.deleted_at.is_(None))
        .all()
    )
    for r in recipes:
        r.user = target
    # The viewer's accepted grants among THIS owner's recipes, in one query, so the
    # per-recipe handoff branch of can_view doesn't fire a lookup each. (A grant is
    # per-recipe, so this is a set-membership test, not a single boolean.)
    granted_ids = set()
    if recipes:
        granted_ids = {
            row.recipe_id
            for row in db.query(Handoff.recipe_id).filter(
                Handoff.recipe_id.in_([r.id for r in recipes]),
                Handoff.to_user_id == current_user.id,
                Handoff.state == "accepted",
            )
        }
    recipe_count = sum(
        1
        for r in recipes
        if can_view(r, current_user, db, is_friend, is_grantee=r.id in granted_ids)
    )

    posts = db.query(Post).filter(Post.user_id == user_id).all()
    for p in posts:
        p.user = target
    post_count = sum(1 for p in posts if can_view_post(p, current_user, db, is_friend))

    # Friend count is a public, symmetric fact about the target — not gated by the
    # caller (unlike recipe/post counts). Reuse friend_ids so there's one definition of
    # "who is an accepted friend"; the list is small, so len() is fine.
    friend_count = len(friend_ids(user_id, db))

    return ProfileResponse(
        user_id=user_id,
        first_name=target.first_name,
        last_name=target.last_name,
        photo_url=target.photo_url,
        profile_visibility=target.profile_visibility,
        friend_state=friend_state,
        friend_can_accept=friend_can_accept,
        recipe_count=recipe_count,
        post_count=post_count,
        friend_count=friend_count,
    )
