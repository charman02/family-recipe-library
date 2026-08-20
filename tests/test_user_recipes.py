"""GET /recipes/users/{id} — the recipe half of a person's profile grid (#69).

Mirrors the visibility contract of GET /posts/users/{id}: your own → all; a friend →
public + friends; a stranger → public only; never a private recipe; and never a recipe
merely handed to you individually (that lives in /recipes/shared, not on a public grid).
"""


def _recipe(client, headers, name, visibility):
    return client.post(
        "/recipes",
        json={
            "name": name,
            "visibility": visibility,
            "steps": [{"content": "cook", "position": 1}],
        },
        headers=headers,
    ).json()


def _befriend(client, a_headers, b, b_headers):
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=a_headers).json()["id"]
    client.post(f"/friends/{fid}/accept", headers=b_headers)


def _names(client, user_id, headers):
    return {r["name"] for r in client.get(f"/recipes/users/{user_id}", headers=headers).json()}


def test_owner_sees_all_their_recipes(client, make_user):
    owner, oh = make_user()
    _recipe(client, oh, "Pub", "public")
    _recipe(client, oh, "Fr", "friends")
    _recipe(client, oh, "Priv", "private")
    assert _names(client, owner.id, oh) == {"Pub", "Fr", "Priv"}


def test_friend_sees_public_and_friends_not_private(client, make_user):
    owner, oh = make_user()
    friend, fh = make_user()
    _befriend(client, oh, friend, fh)
    _recipe(client, oh, "Pub", "public")
    _recipe(client, oh, "Fr", "friends")
    _recipe(client, oh, "Priv", "private")
    assert _names(client, owner.id, fh) == {"Pub", "Fr"}


def test_stranger_sees_only_public(client, make_user):
    owner, oh = make_user()
    _recipe(client, oh, "Pub", "public")
    _recipe(client, oh, "Fr", "friends")
    _recipe(client, oh, "Priv", "private")
    _, sh = make_user()
    assert _names(client, owner.id, sh) == {"Pub"}


def test_stranger_on_all_private_gets_empty_list_not_404(client, make_user):
    owner, oh = make_user()
    _recipe(client, oh, "Priv", "private")
    _, sh = make_user()
    r = client.get(f"/recipes/users/{owner.id}", headers=sh)
    assert r.status_code == 200
    assert r.json() == []


def test_handed_off_recipe_does_not_appear_on_owner_grid(client, make_user):
    # A recipe handed to you individually is readable (via /shared) but must NOT show on
    # the sender's public profile grid — is_grantee=False keeps can_view's grant branch
    # from surfacing it here. The grantee still can't see the owner's OTHER private ones.
    owner, oh = make_user()
    grantee, gh = make_user()
    priv = _recipe(client, oh, "Handed", "private")
    _recipe(client, oh, "NotHanded", "private")  # a second private recipe, never handed
    client.post(f"/recipes/{priv['id']}/handoff", json={"to_user_id": grantee.id}, headers=oh)
    # The grantee CAN read the handed recipe directly...
    assert client.get(f"/recipes/{priv['id']}", headers=gh).status_code == 200
    # ...but the owner's profile grid shows neither private recipe to this non-friend.
    assert _names(client, owner.id, gh) == set()


def test_deleted_recipe_excluded(client, make_user):
    owner, oh = make_user()
    _recipe(client, oh, "Keep", "public")
    gone = _recipe(client, oh, "Gone", "public")
    client.delete(f"/recipes/{gone['id']}", headers=oh)
    assert _names(client, owner.id, oh) == {"Keep"}


def test_grid_is_capped(client, make_user):
    # The response is capped (PROFILE_GRID_LIMIT=30) so a prolific user's profile doesn't
    # return an unbounded list. Cap is applied AFTER the visibility filter, so it never
    # drops a public recipe in favor of a private one.
    owner, oh = make_user()
    for i in range(33):
        _recipe(client, oh, f"R{i}", "public")
    got = client.get(f"/recipes/users/{owner.id}", headers=oh).json()
    assert len(got) == 30


def test_unknown_user_404(client, make_user):
    _, h = make_user()
    assert client.get("/recipes/users/999999", headers=h).status_code == 404


def test_requires_auth(client, make_user):
    owner, _ = make_user()
    assert client.get(f"/recipes/users/{owner.id}").status_code == 401
