"""Keeping a recipe you did not write (#57) — a bookmark, never a copy.

The design decisions this pins:
  - a save is a POINTER: there is still one Recipe row, owned by the cook, so a keeper
    always reads the cook's CURRENT version and the byline stays the cook's;
  - a save is NOT a permission: every read re-checks can_view, so the cook restricting
    or deleting the recipe genuinely ends access, and it lands in `unreachable_count`;
  - you may only keep what you can already read (otherwise bookmarking would be a
    self-grant on a private recipe);
  - the shelf MERGES handed-to-you grants with your own bookmarks on the server, so
    un-keeping can never hide a recipe someone actually sent you;
  - keeping is owner-scoped and idempotent.
"""


def _recipe(client, headers, name="Adobo", visibility="private"):
    r = client.post(
        "/recipes",
        json={
            "name": name,
            "visibility": visibility,
            "steps": [{"content": "Brown the chicken", "position": 1}],
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _befriend(client, a, ah, b, bh):
    fid = client.post("/friends/request", json={"to_user_id": b.id}, headers=ah).json()["id"]
    assert client.post(f"/friends/{fid}/accept", headers=bh).status_code == 200


def _unfriend(client, a, ah, b):
    fid = next(f["id"] for f in client.get("/friends", headers=ah).json() if f["user_id"] == b.id)
    assert client.delete(f"/friends/{fid}", headers=ah).status_code == 204


# --- keeping what you can read ---


def test_keep_a_public_recipe_puts_it_on_your_shelf(client, make_user):
    owner, oh = make_user()
    keeper, kh = make_user()
    rec = _recipe(client, oh, name="Public adobo", visibility="public")

    r = client.post(f"/recipes/{rec['id']}/save", headers=kh)
    assert r.status_code == 201, r.text
    assert r.json()["kept_by_me"] is True
    # It is the COOK's recipe, not a copy: same id, same owner.
    assert r.json()["id"] == rec["id"]
    assert r.json()["user_id"] == owner.id

    shelf = client.get("/recipes/kept", headers=kh).json()
    assert [x["id"] for x in shelf["recipes"]] == [rec["id"]]
    assert shelf["unreachable_count"] == 0
    # And the keeper's OWN recipe list is untouched — nothing was duplicated into it.
    assert client.get("/recipes", headers=kh).json() == []


def test_keeping_is_idempotent(client, make_user):
    _, oh = make_user()
    _, kh = make_user()
    rec = _recipe(client, oh, visibility="public")
    assert client.post(f"/recipes/{rec['id']}/save", headers=kh).status_code == 201
    assert client.post(f"/recipes/{rec['id']}/save", headers=kh).status_code == 201
    assert len(client.get("/recipes/kept", headers=kh).json()["recipes"]) == 1


def test_a_friend_can_keep_a_friends_visibility_recipe(client, make_user):
    owner, oh = make_user()
    friend, fh = make_user()
    _befriend(client, owner, oh, friend, fh)
    rec = _recipe(client, oh, name="Friends dish", visibility="friends")
    assert client.post(f"/recipes/{rec['id']}/save", headers=fh).status_code == 201
    assert len(client.get("/recipes/kept", headers=fh).json()["recipes"]) == 1


def test_cannot_keep_a_recipe_you_cannot_read(client, make_user):
    """THE self-grant test. A save row is created by the reader, so if keeping were
    allowed on an unreadable recipe — or if can_view consulted saves — anyone could
    bookmark a stranger's private recipe and read it. Both directions are closed."""
    _, oh = make_user()
    _, sh = make_user()
    rec = _recipe(client, oh, name="Private dish")  # private, no relationship

    assert client.post(f"/recipes/{rec['id']}/save", headers=sh).status_code == 404
    # Nothing was created, and the recipe is still unreadable.
    assert client.get("/recipes/kept", headers=sh).json() == {
        "recipes": [],
        "unreachable_count": 0,
    }
    assert client.get(f"/recipes/{rec['id']}", headers=sh).status_code == 404


def test_cannot_keep_your_own_recipe(client, make_user):
    _, oh = make_user()
    rec = _recipe(client, oh, visibility="public")
    r = client.post(f"/recipes/{rec['id']}/save", headers=oh)
    assert r.status_code == 400
    # It stays in Recipes, and the Kept shelf does not double-count your own kitchen.
    assert client.get("/recipes/kept", headers=oh).json()["recipes"] == []


def test_keeping_a_deleted_recipe_404s(client, make_user):
    _, oh = make_user()
    _, kh = make_user()
    rec = _recipe(client, oh, visibility="public")
    assert client.delete(f"/recipes/{rec['id']}", headers=oh).status_code == 204
    assert client.post(f"/recipes/{rec['id']}/save", headers=kh).status_code == 404


# --- a save is not a permission: the cook can still take it away ---


def test_recipe_going_private_removes_it_from_the_shelf_and_is_counted(client, make_user):
    owner, oh = make_user()
    keeper, kh = make_user()
    rec = _recipe(client, oh, name="Now you don't", visibility="public")
    client.post(f"/recipes/{rec['id']}/save", headers=kh)
    assert len(client.get("/recipes/kept", headers=kh).json()["recipes"]) == 1

    # The cook changes their mind.
    assert (
        client.patch(f"/recipes/{rec['id']}", json={"visibility": "private"}, headers=oh).status_code
        == 200
    )

    shelf = client.get("/recipes/kept", headers=kh).json()
    assert shelf["recipes"] == []
    assert shelf["unreachable_count"] == 1  # a number, never the dish name
    assert client.get(f"/recipes/{rec['id']}", headers=kh).status_code == 404


def test_unfriending_removes_a_kept_friends_recipe_from_the_shelf(client, make_user):
    owner, oh = make_user()
    friend, fh = make_user()
    _befriend(client, owner, oh, friend, fh)
    rec = _recipe(client, oh, name="Friends only", visibility="friends")
    client.post(f"/recipes/{rec['id']}/save", headers=fh)
    assert len(client.get("/recipes/kept", headers=fh).json()["recipes"]) == 1

    _unfriend(client, owner, oh, friend)

    shelf = client.get("/recipes/kept", headers=fh).json()
    assert shelf["recipes"] == [] and shelf["unreachable_count"] == 1


def test_deleting_the_recipe_removes_it_from_the_shelf_and_is_counted(client, make_user):
    _, oh = make_user()
    _, kh = make_user()
    rec = _recipe(client, oh, visibility="public")
    client.post(f"/recipes/{rec['id']}/save", headers=kh)
    assert client.delete(f"/recipes/{rec['id']}", headers=oh).status_code == 204

    shelf = client.get("/recipes/kept", headers=kh).json()
    assert shelf["recipes"] == [] and shelf["unreachable_count"] == 1


def test_the_keeper_always_reads_the_cooks_current_version(client, make_user):
    """The reason a bookmark beats a copy: the cook's correction reaches the keeper."""
    _, oh = make_user()
    _, kh = make_user()
    rec = _recipe(client, oh, name="Adobo", visibility="public")
    client.post(f"/recipes/{rec['id']}/save", headers=kh)

    client.patch(f"/recipes/{rec['id']}", json={"name": "Adobo (1 tsp, not 1 tbsp)"}, headers=oh)

    shelf = client.get("/recipes/kept", headers=kh).json()
    assert shelf["recipes"][0]["name"] == "Adobo (1 tsp, not 1 tbsp)"


# --- un-keeping ---


def test_unkeeping_removes_only_your_own_shelf_row(client, make_user):
    _, oh = make_user()
    _, k1 = make_user()
    _, k2 = make_user()
    rec = _recipe(client, oh, visibility="public")
    client.post(f"/recipes/{rec['id']}/save", headers=k1)
    client.post(f"/recipes/{rec['id']}/save", headers=k2)

    assert client.delete(f"/recipes/{rec['id']}/save", headers=k1).status_code == 204
    assert client.get("/recipes/kept", headers=k1).json()["recipes"] == []
    # The other keeper is unaffected, and so is the cook's recipe.
    assert len(client.get("/recipes/kept", headers=k2).json()["recipes"]) == 1
    assert client.get(f"/recipes/{rec['id']}", headers=oh).status_code == 200


def test_unkeeping_something_you_never_kept_404s(client, make_user):
    _, oh = make_user()
    _, kh = make_user()
    rec = _recipe(client, oh, visibility="public")
    assert client.delete(f"/recipes/{rec['id']}/save", headers=kh).status_code == 404


# --- the shelf merges grants and bookmarks ---


def test_shelf_merges_handed_to_you_with_kept_by_you(client, make_user):
    owner, oh = make_user()
    other, o2h = make_user()
    keeper, kh = make_user()
    handed = _recipe(client, oh, name="Handed to me")  # private + grant
    client.post(f"/recipes/{handed['id']}/handoff", json={"to_user_id": keeper.id}, headers=oh)
    kept = _recipe(client, o2h, name="Kept by me", visibility="public")
    client.post(f"/recipes/{kept['id']}/save", headers=kh)

    shelf = client.get("/recipes/kept", headers=kh).json()
    assert {x["name"] for x in shelf["recipes"]} == {"Handed to me", "Kept by me"}
    assert shelf["unreachable_count"] == 0


def test_unkeeping_cannot_hide_a_recipe_someone_handed_you(client, make_user):
    """Why the merge happens on the server: the grant stands on its own, so removing a
    bookmark must not be able to remove a gift. (Here the same recipe is both.)"""
    owner, oh = make_user()
    keeper, kh = make_user()
    rec = _recipe(client, oh, name="Given and kept", visibility="public")
    client.post(f"/recipes/{rec['id']}/handoff", json={"to_user_id": keeper.id}, headers=oh)
    client.post(f"/recipes/{rec['id']}/save", headers=kh)
    assert len(client.get("/recipes/kept", headers=kh).json()["recipes"]) == 1

    assert client.delete(f"/recipes/{rec['id']}/save", headers=kh).status_code == 204
    # Still there — because it was handed to them, not merely bookmarked.
    shelf = client.get("/recipes/kept", headers=kh).json()
    assert [x["name"] for x in shelf["recipes"]] == ["Given and kept"]
    assert shelf["unreachable_count"] == 0


def test_shelf_never_lists_your_own_recipes(client, make_user):
    _, oh = make_user()
    _recipe(client, oh, name="Mine", visibility="public")
    assert client.get("/recipes/kept", headers=oh).json() == {
        "recipes": [],
        "unreachable_count": 0,
    }


# --- keeping grants nothing beyond reading ---


def test_keeping_does_not_let_you_edit_delete_or_hand_on(client, make_user):
    """Read is not write, and keeping is not owning. A keeper's shelf entry must not
    become a licence to change the cook's record or move it to a third person — the
    latter is why #57 shipped keep-only, with re-sharing left to the cook."""
    owner, oh = make_user()
    keeper, kh = make_user()
    third, _ = make_user()
    rec = _recipe(client, oh, name="Still theirs", visibility="public")
    assert client.post(f"/recipes/{rec['id']}/save", headers=kh).status_code == 201

    assert client.patch(f"/recipes/{rec['id']}", json={"name": "Mine now"}, headers=kh).status_code == 404
    assert client.delete(f"/recipes/{rec['id']}", headers=kh).status_code == 404
    assert (
        client.post(
            f"/recipes/{rec['id']}/handoff", json={"to_user_id": third.id}, headers=kh
        ).status_code
        == 404
    )
    assert client.get(f"/recipes/{rec['id']}", headers=oh).json()["name"] == "Still theirs"


def test_kept_by_me_is_only_ever_about_the_caller(client, make_user):
    """No keeper counts, no keeper names — the response says whether YOU kept it and
    nothing about anyone else (a count would be child_count restored, i.e. a like button)."""
    _, oh = make_user()
    _, k1 = make_user()
    _, k2 = make_user()
    rec = _recipe(client, oh, visibility="public")
    client.post(f"/recipes/{rec['id']}/save", headers=k1)

    assert client.get(f"/recipes/{rec['id']}", headers=k1).json()["kept_by_me"] is True
    assert client.get(f"/recipes/{rec['id']}", headers=k2).json()["kept_by_me"] is False
    body = client.get(f"/recipes/{rec['id']}", headers=oh)
    assert body.json()["kept_by_me"] is False  # the owner doesn't "keep" their own
    # Nothing in the payload counts or names keepers.
    for banned in ("keeper", "keepers", "save_count", "kept_count", "keep_count", "saved_by"):
        assert banned not in body.text


def test_kept_endpoints_require_auth(client, make_user):
    make_user()
    assert client.get("/recipes/kept").status_code == 401
    assert client.post("/recipes/1/save").status_code == 401
    assert client.delete("/recipes/1/save").status_code == 401
