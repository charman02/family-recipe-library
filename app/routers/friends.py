from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
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
    FriendRequestIn,
    FriendResponse,
    FriendSuggestion,
    ProfileResponse,
)
from app.services.friends import existing_friendship
from app.services.sharing import can_view, can_view_post

router = APIRouter(prefix="/friends", tags=["friends"])


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caller's ACCEPTED friends."""
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
                reason=reason_by_id[uid],
            )
        )
    return out


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

    return ProfileResponse(
        user_id=user_id,
        first_name=target.first_name,
        last_name=target.last_name,
        profile_visibility=target.profile_visibility,
        friend_state=friend_state,
        friend_can_accept=friend_can_accept,
        recipe_count=recipe_count,
        post_count=post_count,
    )
