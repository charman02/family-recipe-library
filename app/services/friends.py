"""The friend graph — one place that answers "are these two users friends?".

Like `can_view` for recipes, this is the SINGLE predicate every friends-gated
surface (the feed, friends-visibility, profiles) funnels through. A second, subtly
different definition elsewhere is how a private thing leaks to the wrong person, so
keep the rule here and call it — don't re-derive membership inline.
"""

from sqlalchemy import or_, and_

from app.models.friendship import Friendship


def are_friends(user_a_id, user_b_id, db) -> bool:
    """True iff an ACCEPTED friendship links the two, in either direction.

    Direction is irrelevant to friendship (only to who may accept a pending
    request), so this checks both orderings. A user is never their own friend.
    """
    if user_a_id == user_b_id:
        return False
    row = (
        db.query(Friendship.id)
        .filter(
            Friendship.state == "accepted",
            or_(
                and_(
                    Friendship.requester_id == user_a_id,
                    Friendship.addressee_id == user_b_id,
                ),
                and_(
                    Friendship.requester_id == user_b_id,
                    Friendship.addressee_id == user_a_id,
                ),
            ),
        )
        .first()
    )
    return row is not None


def existing_friendship(user_a_id, user_b_id, db):
    """The Friendship row between two users regardless of direction/state, or None.
    Used to enforce one row per pair (refuse a reverse-direction duplicate) and to
    report relationship status on a profile."""
    return (
        db.query(Friendship)
        .filter(
            or_(
                and_(
                    Friendship.requester_id == user_a_id,
                    Friendship.addressee_id == user_b_id,
                ),
                and_(
                    Friendship.requester_id == user_b_id,
                    Friendship.addressee_id == user_a_id,
                ),
            )
        )
        .first()
    )


def friend_ids(user_id, db) -> list[int]:
    """All user ids ACCEPTED-friends with this user, either direction. The feed and
    profile queries use this to scope to friends."""
    rows = (
        db.query(Friendship.requester_id, Friendship.addressee_id)
        .filter(
            Friendship.state == "accepted",
            or_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == user_id,
            ),
        )
        .all()
    )
    out = []
    for requester_id, addressee_id in rows:
        out.append(addressee_id if requester_id == user_id else requester_id)
    return out
