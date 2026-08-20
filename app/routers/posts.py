from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.post import Post
from app.schemas.post import PostCreate, PostResponse
from app.services.friends import are_friends, friend_ids
from app.services.sharing import can_view, can_view_post

router = APIRouter(prefix="/posts", tags=["posts"])

# Feed page size — bounded so one request can't pull an unbounded history on a phone.
FEED_PAGE = 30


def _to_response(post: Post, author: User, viewable_recipe_ids: set) -> PostResponse:
    # Expose the recipe link ONLY when the viewer can actually open it. A post links
    # a recipe the AUTHOR owns, but the viewer is usually a friend — and the author
    # may have made that recipe private, or soft-deleted it, after posting. Surfacing
    # recipe_id anyway gives a "See the recipe" link that dead-ends on a 404
    # (get_recipe → can_view denies a non-owner on a private recipe, and filters out
    # soft-deleted rows). Nulling it here means the card just omits the link instead.
    recipe_id = post.recipe_id if post.recipe_id in viewable_recipe_ids else None
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        author_first_name=author.first_name,
        author_last_name=author.last_name,
        author_photo_url=author.photo_url,
        photo_url=post.photo_url,
        dish_name=post.dish_name,
        description=post.description,
        recipe_id=recipe_id,
        visibility=post.visibility,
        created_at=post.created_at,
    )


def _viewable_recipe_ids(posts, viewer: User, db: Session) -> set:
    """The subset of the posts' linked recipe_ids that `viewer` may actually read, by
    the single recipe rule (services.sharing.can_view: owner OR the visibility rule
    allows the viewer OR an accepted handoff), minus soft-deleted recipes. Callers pass
    the result to _to_response, which nulls any recipe_id not in the set so a
    "See the recipe" link is only shown when it would resolve.

    Loads the Recipe rows with their owner (for can_view's profile check) in one query;
    can_view's handoff lookup is per-recipe, but a feed page links few distinct recipes
    so this stays cheap."""
    recipe_ids = {p.recipe_id for p in posts if p.recipe_id is not None}
    if not recipe_ids:
        return set()
    recipes = (
        db.query(Recipe)
        .options(selectinload(Recipe.user))
        .filter(Recipe.id.in_(recipe_ids), Recipe.deleted_at.is_(None))
        .all()
    )
    return {r.id for r in recipes if can_view(r, viewer, db)}


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Share a meal: photo + dish name (+ optional line, + optional link to a recipe
    you OWN). Not a recipe — carries no ingredients/steps."""
    recipe_id = None
    if body.recipe_id is not None:
        # Only link a recipe the caller owns and hasn't deleted — never someone
        # else's, and never a tombstone.
        recipe = (
            db.query(Recipe)
            .filter(
                Recipe.id == body.recipe_id,
                Recipe.user_id == current_user.id,
                Recipe.deleted_at.is_(None),
            )
            .first()
        )
        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found")
        recipe_id = recipe.id

    post = Post(
        user_id=current_user.id,
        photo_url=body.photo_url,
        dish_name=body.dish_name.strip(),
        description=(body.description or "").strip() or None,
        recipe_id=recipe_id,
        visibility=body.visibility,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    # The author owns any linked recipe (verified above), so it's viewable to them.
    return _to_response(post, current_user, {recipe_id} if recipe_id else set())


@router.get("/feed", response_model=list[PostResponse])
def feed(
    before_id: int | None = Query(
        default=None,
        description="Cursor: id of the last post on the previous page. Returns the "
        "page of posts older than it.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The presence feed: posts by the caller's ACCEPTED friends, plus the caller's
    own, newest first. Scope is the whole point — a non-friend's post can never
    appear here (friends resolved via services.friends).

    KEYSET pagination on `id`, not `created_at`. `id` is a monotonic insertion
    counter and a post's created_at is server-set at that same insert (never
    backdated), so `id DESC` IS reverse-chronological — the same order a
    (created_at DESC, id DESC) sort would give, but from a single exact key. That
    matters because a created_at cursor is fragile: SQLite stores the column as a
    second-granularity TEXT string ("…12:34:56") while a bound datetime renders
    padded ("…12:34:56.000000"), so the string compare mis-orders posts that share
    a second and can skip or repeat one at a page boundary. An integer id cursor has
    none of that — it can't skip or duplicate, on SQLite or Postgres.

    Own posts are included so an active poster with few friends still sees a feed
    rather than a blank screen (BeReal shows yours too).

    A friend's PRIVATE post is excluded even here: the scope is friends, but a private
    post is theirs alone (can_view_post). friends/public posts show normally. (The
    friends/everyone toggle that widens scope to public strangers is a later step; this
    feed is friends-only.)"""
    friends = set(friend_ids(current_user.id, db))
    q = db.query(Post).options(selectinload(Post.user)).filter(
        Post.user_id.in_(friends | {current_user.id})
    )
    if before_id is not None:
        q = q.filter(Post.id < before_id)
    posts = q.order_by(Post.id.desc()).limit(FEED_PAGE).all()
    # Every author here is the caller or an accepted friend (that's the query scope), so
    # the viewer↔author friendship is known — pass it to can_view_post so a "friends"
    # post isn't re-queried per row. This still drops a friend's PRIVATE post.
    posts = [
        p
        for p in posts
        if can_view_post(p, current_user, db, is_friend=p.user_id in friends)
    ]
    viewable = _viewable_recipe_ids(posts, current_user, db)
    return [_to_response(p, p.user, viewable) for p in posts]


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A single post — visible per the one post rule (can_view_post): the author, a
    friend on an inherit/private-profile post, or ANYONE on a force-public post (that's
    how a private-profile user surfaces one meal). A viewer who fails the rule gets 404,
    not 403 — don't confirm the post exists to someone not entitled to see it."""
    post = (
        db.query(Post)
        .options(selectinload(Post.user))
        .filter(Post.id == post_id)
        .first()
    )
    if post is None or post.user is None:
        # The FK cascade means a surviving post always has an author; guard anyway.
        raise HTTPException(status_code=404, detail="Post not found")
    if not can_view_post(post, current_user, db):
        raise HTTPException(status_code=404, detail="Post not found")
    viewable = _viewable_recipe_ids([post], current_user, db)
    return _to_response(post, post.user, viewable)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Author-only. Read is not write — a friend can see a post, never delete it.
    A non-author (or unknown id) gets 404, not 403."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None or post.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return None


@router.get("/users/{user_id}", response_model=list[PostResponse])
def user_posts(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A user's posts, for their profile grid, filtered by the one post rule
    (can_view_post): your own → all; a friend → their friends + public posts (never a
    private one); a non-friend → only the user's public posts (a private-profile user's
    public meals still show on their profile). A non-friend on a fully-private profile
    just sees an empty grid — not a 404, since the profile itself is reachable."""
    author = db.query(User).filter(User.id == user_id).first()
    if author is None:
        raise HTTPException(status_code=404, detail="User not found")
    posts = (
        db.query(Post)
        .options(selectinload(Post.user))
        .filter(Post.user_id == user_id)
        # id DESC == reverse-chron here too (see feed()); one consistent ordering key.
        .order_by(Post.id.desc())
        .limit(FEED_PAGE)
        .all()
    )
    # The viewer↔profile-owner friendship is invariant across every post — resolve it
    # once (or trivially for one's own profile) rather than per row.
    is_friend = user_id == current_user.id or are_friends(current_user.id, user_id, db)
    posts = [p for p in posts if can_view_post(p, current_user, db, is_friend=is_friend)]
    viewable = _viewable_recipe_ids(posts, current_user, db)
    return [_to_response(p, p.user, viewable) for p in posts]
