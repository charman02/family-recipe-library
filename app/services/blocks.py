"""The single blocking predicate (#85).

Same discipline as `can_view` for reads and `are_friends` for friendship: ONE function
answers "are these two blocked from each other", and every enforcement point calls it. A
second, subtly different check elsewhere is how a blocked person keeps getting through.

The row is directional; the ANSWER is symmetric. A block in either direction means neither
sees the other, because one-way blocking doesn't achieve what blocking is for — you'd keep
running into their meals in Browse.
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.block import Block


def is_blocked(a_id, b_id, db: Session) -> bool:
    """Is there a block between these two, in either direction?

    Returns False when either id is None (an unauthenticated read has no viewer to block —
    the invite-token path, for instance) and when they're the same person.
    """
    if a_id is None or b_id is None or a_id == b_id:
        return False
    return (
        db.query(Block.id)
        .filter(
            or_(
                (Block.blocker_id == a_id) & (Block.blocked_id == b_id),
                (Block.blocker_id == b_id) & (Block.blocked_id == a_id),
            )
        )
        .first()
        is not None
    )


def blocked_ids(user_id, db: Session) -> set:
    """Everyone this user is blocked from, in either direction — for the list endpoints.

    A feed page or the people directory would otherwise pay one `is_blocked` query per row.
    This is the same precompute-the-data-not-the-logic pattern `_resource_is_visible`'s
    `is_friend` parameter uses: callers may hand the ANSWER in, never a second copy of the
    rule.
    """
    if user_id is None:
        return set()
    out = set()
    for blocker, blocked in db.query(Block.blocker_id, Block.blocked_id).filter(
        or_(Block.blocker_id == user_id, Block.blocked_id == user_id)
    ):
        out.add(blocked if blocker == user_id else blocker)
    return out
