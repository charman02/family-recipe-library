"""The friend graph (social feed Phase 0).

Symmetric friends, both-accept. SCOPE + AUTHORIZATION is the whole story here, same
as sharing: only the addressee may accept; a non-party can't touch or probe a
friendship; suggestions come only from the handoff graph, never strangers.
"""


def _recipe(client, headers, name="Adobo", visibility="private"):
    r = client.post(
        "/recipes",
        json={"name": name, "visibility": visibility, "steps": [{"content": "Cook", "position": 1}]},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


def _handoff(client, owner_headers, recipe_id, to_user_id):
    r = client.post(
        f"/recipes/{recipe_id}/handoff", json={"to_user_id": to_user_id}, headers=owner_headers
    )
    assert r.status_code == 201
    return r.json()


# --- requesting + accepting ---


def test_request_then_accept_makes_friends(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    r = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)
    assert r.status_code == 201
    fid = r.json()["id"]
    assert r.json()["state"] == "pending"
    assert r.json()["outgoing"] is True
    assert r.json()["user_id"] == b.id  # the OTHER person, from A's view

    # B sees it as an incoming request they can accept.
    reqs = client.get("/friends/requests", headers=bh).json()
    assert len(reqs) == 1 and reqs[0]["user_id"] == a.id and reqs[0]["outgoing"] is False

    acc = client.post(f"/friends/{fid}/accept", headers=bh)
    assert acc.status_code == 200 and acc.json()["state"] == "accepted"

    # Both now list each other as a friend.
    assert [f["user_id"] for f in client.get("/friends", headers=ah).json()] == [b.id]
    assert [f["user_id"] for f in client.get("/friends", headers=bh).json()] == [a.id]


def test_cannot_friend_yourself(client, make_user):
    a, ah = make_user()
    r = client.post("/friends/request", json={"to_user_id": a.id}, headers=ah)
    assert r.status_code == 400


def test_request_to_unknown_user_404(client, make_user):
    _, ah = make_user()
    r = client.post("/friends/request", json={"to_user_id": 999999}, headers=ah)
    assert r.status_code == 404


def test_only_the_addressee_may_accept(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    stranger, sh = make_user()
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()["id"]
    # The requester can't accept their own request...
    assert client.post(f"/friends/{fid}/accept", headers=ah).status_code == 404
    # ...nor can an unrelated user.
    assert client.post(f"/friends/{fid}/accept", headers=sh).status_code == 404
    # The addressee can.
    assert client.post(f"/friends/{fid}/accept", headers=bh).status_code == 200


def test_reverse_request_accepts_the_pending_one(client, make_user):
    # A requests B; then B requests A back — that mutual intent should resolve to
    # accepted without a second row.
    a, ah = make_user()
    b, bh = make_user()
    client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)
    r = client.post("/friends/request", json={"to_user_id": a.id}, headers=bh)
    assert r.status_code == 201 and r.json()["state"] == "accepted"
    assert [f["user_id"] for f in client.get("/friends", headers=ah).json()] == [b.id]


def test_duplicate_request_returns_existing_not_a_second_row(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    first = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()
    second = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()
    assert first["id"] == second["id"]


def test_one_row_per_unordered_pair(client, make_user, db_session):
    # The DB-level guard: uq_friendship_pair is on the NORMALIZED (low, high) pair,
    # so no direction of requesting can create a second row for the same two people.
    from app.models.friendship import Friendship

    a, ah = make_user()
    b, bh = make_user()
    client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)
    client.post("/friends/request", json={"to_user_id": a.id}, headers=bh)  # reverse
    client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)  # dup
    rows = db_session.query(Friendship).all()
    assert len(rows) == 1
    # pair_low/pair_high are normalized (min, max) regardless of who requested.
    row = rows[0]
    assert row.pair_low == min(a.id, b.id)
    assert row.pair_high == max(a.id, b.id)


# --- removing ---


def test_either_party_can_unfriend(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()["id"]
    client.post(f"/friends/{fid}/accept", headers=bh)
    assert client.delete(f"/friends/{fid}", headers=bh).status_code == 204
    assert client.get("/friends", headers=ah).json() == []
    assert client.get("/friends", headers=bh).json() == []


def test_non_party_cannot_delete_a_friendship(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    stranger, sh = make_user()
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()["id"]
    assert client.delete(f"/friends/{fid}", headers=sh).status_code == 404


# --- suggestions: handoff graph only ---


def test_suggestions_come_from_the_handoff_graph(client, make_user):
    a, ah = make_user()      # cooks
    b, b_obj = make_user()   # A hands a recipe TO them
    c, c_obj = make_user()   # hands a recipe to A
    stranger, sh = make_user()  # no handoff either way

    # A → B (A owns a recipe, hands it to B)
    rec_a = _recipe(client, ah, "A's dish")
    _handoff(client, ah, rec_a["id"], b.id)
    # C → A (C owns a recipe, hands it to A)
    rec_c = _recipe(client, c_obj, "C's dish")
    _handoff(client, c_obj, rec_c["id"], a.id)

    sugg = client.get("/friends/suggestions", headers=ah).json()
    by_id = {s["user_id"]: s for s in sugg}
    assert b.id in by_id and by_id[b.id]["reason"] == "sent"
    assert c.id in by_id and by_id[c.id]["reason"] == "received"
    # A stranger with no handoff to/from A is never suggested.
    assert stranger.id not in by_id


def test_suggestions_exclude_existing_friends_and_pending(client, make_user):
    a, ah = make_user()
    b, b_obj = make_user()
    rec = _recipe(client, ah, "shared")
    _handoff(client, ah, rec["id"], b.id)
    # Before any friendship, B is suggested.
    assert b.id in {s["user_id"] for s in client.get("/friends/suggestions", headers=ah).json()}
    # Once a request exists, B drops out of suggestions.
    client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)
    assert b.id not in {s["user_id"] for s in client.get("/friends/suggestions", headers=ah).json()}


# --- profile ---


def test_profile_shows_friend_state_and_public_recipe_count(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    _recipe(client, bh, "B public", visibility="public")
    _recipe(client, bh, "B private", visibility="private")

    prof = client.get(f"/friends/profile/{b.id}", headers=ah).json()
    assert prof["user_id"] == b.id
    assert prof["friend_state"] is None
    # Only B's PUBLIC recipe is counted for a non-friend — private isn't leaked.
    assert prof["recipe_count"] == 1


def test_profile_counts_all_own_recipes(client, make_user):
    a, ah = make_user()
    _recipe(client, ah, "mine public", visibility="public")
    _recipe(client, ah, "mine private", visibility="private")
    prof = client.get(f"/friends/profile/{a.id}", headers=ah).json()
    assert prof["recipe_count"] == 2  # own profile sees all


def test_profile_reports_friend_count(client, make_user):
    # friend_count is a public, symmetric fact — not gated by the caller. Powers the
    # "You" page identity-box counts.
    a, ah = make_user()
    b, bh = make_user()
    c, ch = make_user()
    # a befriends both b and c.
    for other, oh in [(b, bh), (c, ch)]:
        fid = client.post("/friends/request", json={"to_user_id": other.id}, headers=ah).json()["id"]
        client.post(f"/friends/{fid}/accept", headers=oh)
    # A's own profile reports 2 friends...
    assert client.get(f"/friends/profile/{a.id}", headers=ah).json()["friend_count"] == 2
    # ...and a stranger sees the same count (it's not gated).
    stranger, sh = make_user()
    assert client.get(f"/friends/profile/{a.id}", headers=sh).json()["friend_count"] == 2
    # B has just the one friend (a).
    assert client.get(f"/friends/profile/{b.id}", headers=bh).json()["friend_count"] == 1


def test_profile_reports_pending_acceptability(client, make_user):
    a, ah = make_user()
    b, bh = make_user()
    client.post("/friends/request", json={"to_user_id": b.id}, headers=ah)
    # From B's side, the pending request is acceptable.
    prof_from_b = client.get(f"/friends/profile/{a.id}", headers=bh).json()
    assert prof_from_b["friend_state"] == "pending" and prof_from_b["friend_can_accept"] is True
    # From A's side (the requester), it's pending but NOT acceptable by them.
    prof_from_a = client.get(f"/friends/profile/{b.id}", headers=ah).json()
    assert prof_from_a["friend_state"] == "pending" and prof_from_a["friend_can_accept"] is False


def test_all_friends_endpoints_require_auth(client, make_user):
    make_user()
    assert client.get("/friends").status_code == 401
    assert client.get("/friends/requests").status_code == 401
    assert client.get("/friends/suggestions").status_code == 401
    assert client.post("/friends/request", json={"to_user_id": 1}).status_code == 401
