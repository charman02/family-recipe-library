"""The presence feed (social feed Phase 1): posts + friends-scoped feed.

Scope is the invariant that matters: the feed shows the caller's friends' posts
(and their own), never a non-friend's. Delete is author-only (read is not write).
"""


def _befriend(client, a, ah, b, bh):
    """Make A and B accepted friends."""
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()["id"]
    client.post(f"/friends/{fid}/accept", headers=bh)


def _post(client, headers, dish="Adobo", description=None, photo="https://img.test/x.jpg", recipe_id=None):
    body = {"photo_url": photo, "dish_name": dish}
    if description is not None:
        body["description"] = description
    if recipe_id is not None:
        body["recipe_id"] = recipe_id
    r = client.post("/posts", json=body, headers=headers)
    return r


# --- creating ---


def test_create_post_minimal(client, make_user):
    _, h = make_user()
    r = _post(client, h, dish="Sinigang")
    assert r.status_code == 201
    body = r.json()
    assert body["dish_name"] == "Sinigang"
    assert body["recipe_id"] is None
    assert body["author_first_name"]


def test_dish_name_required(client, make_user):
    _, h = make_user()
    r = client.post("/posts", json={"photo_url": "https://img.test/x.jpg"}, headers=h)
    assert r.status_code == 422


def test_whitespace_only_dish_name_rejected(client, make_user):
    # A spaces-only name must fail at the boundary (422), not slip through
    # min_length and get stripped to empty in the router.
    _, h = make_user()
    r = _post(client, h, dish="   ")
    assert r.status_code == 422


def test_dish_name_is_stripped(client, make_user):
    _, h = make_user()
    r = _post(client, h, dish="  Adobo  ")
    assert r.status_code == 201
    assert r.json()["dish_name"] == "Adobo"


def test_can_link_own_recipe_but_not_someone_elses(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    mine = client.post(
        "/recipes",
        json={"name": "Mine", "steps": [{"content": "cook", "position": 1}]},
        headers=ah,
    ).json()
    theirs = client.post(
        "/recipes",
        json={"name": "Theirs", "steps": [{"content": "cook", "position": 1}]},
        headers=bh,
    ).json()
    # Linking my own recipe works.
    ok = _post(client, ah, recipe_id=mine["id"])
    assert ok.status_code == 201 and ok.json()["recipe_id"] == mine["id"]
    # Linking someone else's is refused.
    bad = _post(client, ah, recipe_id=theirs["id"])
    assert bad.status_code == 404


def _make_recipe(client, headers, name="Dish", visibility="public"):
    return client.post(
        "/recipes",
        json={
            "name": name,
            "visibility": visibility,
            "steps": [{"content": "cook", "position": 1}],
        },
        headers=headers,
    ).json()


def test_linked_recipe_hidden_from_a_friend_who_cannot_view_it(client, make_user):
    # A post links a recipe the AUTHOR owns, but a friend viewing the feed can only
    # see the link if THEY can read that recipe. A private recipe → the friend's
    # response nulls recipe_id (no dead-end "See the recipe" link), while the author
    # still sees it on their own view.
    author, ah = make_user()
    friend, fh = make_user()
    _befriend(client, author, ah, friend, fh)
    private = _make_recipe(client, ah, name="Secret", visibility="private")
    pid = _post(client, ah, dish="Secret dish", recipe_id=private["id"]).json()["id"]

    # Author sees the link on their own post.
    assert client.get(f"/posts/{pid}", headers=ah).json()["recipe_id"] == private["id"]
    # Friend can see the POST but not the private recipe → recipe_id is nulled.
    assert client.get(f"/posts/{pid}", headers=fh).json()["recipe_id"] is None
    # And it's nulled in the friend's feed too.
    feed = client.get("/posts/feed", headers=fh).json()
    linked = next(p for p in feed if p["id"] == pid)
    assert linked["recipe_id"] is None


def test_public_linked_recipe_visible_to_friend(client, make_user):
    author, ah = make_user()
    friend, fh = make_user()
    _befriend(client, author, ah, friend, fh)
    pub = _make_recipe(client, ah, name="Open", visibility="public")
    pid = _post(client, ah, dish="Open dish", recipe_id=pub["id"]).json()["id"]
    # A public recipe is readable by the friend, so the link stays.
    assert client.get(f"/posts/{pid}", headers=fh).json()["recipe_id"] == pub["id"]


def test_soft_deleted_linked_recipe_link_disappears(client, make_user):
    # Soft-deleting the linked recipe leaves the post standing but drops the link
    # (the recipe is no longer viewable by anyone via get_recipe).
    author, ah = make_user()
    pub = _make_recipe(client, ah, name="Gone", visibility="public")
    pid = _post(client, ah, dish="Gone dish", recipe_id=pub["id"]).json()["id"]
    assert client.get(f"/posts/{pid}", headers=ah).json()["recipe_id"] == pub["id"]
    client.delete(f"/recipes/{pub['id']}", headers=ah)
    # Post still exists; its recipe link is gone.
    resp = client.get(f"/posts/{pid}", headers=ah)
    assert resp.status_code == 200
    assert resp.json()["recipe_id"] is None


# --- the feed: scope is everything ---


def test_feed_shows_friends_posts_and_own_not_strangers(client, make_user):
    me, mh = make_user()
    friend, fh = make_user()
    stranger, sh = make_user()
    _befriend(client, me, mh, friend, fh)

    _post(client, fh, dish="Friend's dish")
    _post(client, sh, dish="Stranger's dish")
    _post(client, mh, dish="My dish")

    feed = client.get("/posts/feed", headers=mh).json()
    dishes = {p["dish_name"] for p in feed}
    assert "Friend's dish" in dishes
    assert "My dish" in dishes  # own posts included
    assert "Stranger's dish" not in dishes  # THE scope guarantee


def test_feed_is_reverse_chron(client, make_user):
    me, mh = make_user()
    _post(client, mh, dish="first")
    _post(client, mh, dish="second")
    _post(client, mh, dish="third")
    feed = client.get("/posts/feed", headers=mh).json()
    assert [p["dish_name"] for p in feed] == ["third", "second", "first"]


def test_feed_cursor_returns_only_posts_older_than_it(client, make_user):
    # The cursor is `id < before_id` — an integer keyset, so it's exact regardless
    # of timestamp granularity. A cursor at the newest post returns the rest; a
    # cursor at the oldest returns nothing.
    _, mh = make_user()
    for i in range(3):
        _post(client, mh, dish=f"dish {i}")
    full = client.get("/posts/feed", headers=mh).json()
    assert len(full) == 3

    newest_id = full[0]["id"]
    after_newest = client.get(f"/posts/feed?before_id={newest_id}", headers=mh).json()
    assert [p["id"] for p in after_newest] == [p["id"] for p in full[1:]]

    oldest_id = full[-1]["id"]
    assert client.get(f"/posts/feed?before_id={oldest_id}", headers=mh).json() == []


def test_feed_keyset_cursor_paginates_without_skipping(client, make_user):
    # Keyset cursor on id: given the last row of a page, the next call returns
    # everything with a smaller id, in feed order. Even when posts share a
    # second-granularity timestamp, an integer cursor can't skip or repeat one at a
    # page boundary. Walk the whole feed one row at a time and assert we see every
    # post exactly once, in order.
    _, mh = make_user()
    for i in range(5):
        _post(client, mh, dish=f"dish {i}")

    full = client.get("/posts/feed", headers=mh).json()
    assert [p["dish_name"] for p in full] == [f"dish {i}" for i in range(4, -1, -1)]

    walked = []
    before_id = None
    for _ in range(len(full) + 2):  # +2 guards against an infinite loop
        url = "/posts/feed"
        if before_id is not None:
            url += f"?before_id={before_id}"
        page = client.get(url, headers=mh).json()
        if not page:
            break
        # Take one row per step to force the boundary to land on every post.
        row = page[0]
        walked.append(row["dish_name"])
        before_id = row["id"]

    assert walked == [f"dish {i}" for i in range(4, -1, -1)]


def test_unfriending_removes_posts_from_feed(client, make_user):
    me, mh = make_user()
    friend, fh = make_user()
    fid = client.post("/friends/request", json={"to_user_id": friend.id}, headers=mh).json()["id"]
    client.post(f"/friends/{fid}/accept", headers=fh)
    _post(client, fh, dish="theirs")
    assert "theirs" in {p["dish_name"] for p in client.get("/posts/feed", headers=mh).json()}
    client.delete(f"/friends/{fid}", headers=mh)
    assert "theirs" not in {p["dish_name"] for p in client.get("/posts/feed", headers=mh).json()}


# --- single post + delete ---


def test_get_post_visible_to_friend_not_stranger(client, make_user):
    author, ah = make_user()
    friend, fh = make_user()
    stranger, sh = make_user()
    _befriend(client, author, ah, friend, fh)
    pid = _post(client, ah, dish="Adobo").json()["id"]

    assert client.get(f"/posts/{pid}", headers=ah).status_code == 200   # author
    assert client.get(f"/posts/{pid}", headers=fh).status_code == 200   # friend
    assert client.get(f"/posts/{pid}", headers=sh).status_code == 404   # stranger


def test_delete_is_author_only(client, make_user):
    author, ah = make_user()
    friend, fh = make_user()
    _befriend(client, author, ah, friend, fh)
    pid = _post(client, ah, dish="Adobo").json()["id"]
    # A friend can see it but not delete it.
    assert client.delete(f"/posts/{pid}", headers=fh).status_code == 404
    # The author can.
    assert client.delete(f"/posts/{pid}", headers=ah).status_code == 204
    assert client.get(f"/posts/{pid}", headers=ah).status_code == 404


def test_user_posts_friend_gated(client, make_user):
    author, ah = make_user()
    friend, fh = make_user()
    stranger, sh = make_user()
    _befriend(client, author, ah, friend, fh)
    _post(client, ah, dish="Adobo")
    # Own + friend see the posts; a stranger sees an empty list (profile is public,
    # posts are not).
    assert len(client.get(f"/posts/users/{author.id}", headers=ah).json()) == 1
    assert len(client.get(f"/posts/users/{author.id}", headers=fh).json()) == 1
    assert client.get(f"/posts/users/{author.id}", headers=sh).json() == []


def test_all_post_endpoints_require_auth(client, make_user):
    make_user()
    assert client.get("/posts/feed").status_code == 401
    assert client.post("/posts", json={"photo_url": "x", "dish_name": "y"}).status_code == 401
