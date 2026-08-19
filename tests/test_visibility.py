def _payload(name="Adobo", **extra):
    return {
        "name": name,
        "ingredients": [
            {"name": "chicken", "quantity_text": "2 lbs", "quantity_type": "precise", "position": 1}
        ],
        "steps": [{"content": "Cook", "position": 1}],
        **extra,
    }


def test_create_defaults_friends(client, make_user):
    # New recipes default to "friends" when the schema is given no visibility — the safe
    # concrete fallback. (The add form auto-selects "public" or "friends" from the
    # author's profile and always sends a value; this is the API-level default.)
    _, headers = make_user()
    r = client.post("/recipes", json=_payload(), headers=headers)
    assert r.status_code == 201
    assert r.json()["visibility"] == "friends"


def test_create_private_when_requested(client, make_user):
    _, headers = make_user()
    r = client.post("/recipes", json=_payload(visibility="private"), headers=headers)
    assert r.status_code == 201
    assert r.json()["visibility"] == "private"


def test_create_public_when_requested(client, make_user):
    _, headers = make_user()
    r = client.post("/recipes", json=_payload(visibility="public"), headers=headers)
    assert r.status_code == 201
    assert r.json()["visibility"] == "public"


def test_create_rejects_bad_visibility(client, make_user):
    _, headers = make_user()
    r = client.post("/recipes", json=_payload(visibility="secret"), headers=headers)
    assert r.status_code == 422


def test_patch_root_toggles_visibility(client, make_user):
    _, headers = make_user()
    root = client.post("/recipes", json=_payload(), headers=headers).json()
    r = client.patch(f"/recipes/{root['id']}", json={"visibility": "public"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["visibility"] == "public"
    # reversible
    r2 = client.patch(f"/recipes/{root['id']}", json={"visibility": "private"}, headers=headers)
    assert r2.json()["visibility"] == "private"


def test_patch_bad_visibility_rejected(client, make_user):
    _, headers = make_user()
    root = client.post("/recipes", json=_payload(), headers=headers).json()
    r = client.patch(f"/recipes/{root['id']}", json={"visibility": "everyone"}, headers=headers)
    assert r.status_code == 422


def test_public_root_visible_to_non_owner_and_in_browse(client, make_user, db_session):
    _, owner = make_user()
    root = client.post("/recipes", json=_payload(visibility="public"), headers=owner).json()
    _, other = make_user()
    # non-owner can view a public recipe
    assert client.get(f"/recipes/{root['id']}", headers=other).status_code == 200
    # appears in the (unauthenticated) browse feed
    assert any(r["id"] == root["id"] for r in client.get("/recipes/browse").json())


def test_private_root_hidden_from_non_owner_and_browse(client, make_user):
    _, owner = make_user()
    root = client.post(
        "/recipes", json=_payload(visibility="private"), headers=owner
    ).json()
    _, other = make_user()
    assert client.get(f"/recipes/{root['id']}", headers=other).status_code == 404
    assert all(r["id"] != root["id"] for r in client.get("/recipes/browse").json())


def test_browse_shows_only_public_recipes(client, make_user):
    # Browse shows exactly the concretely-public recipes — visibility is per-recipe, so
    # a "friends" or "private" recipe never appears, regardless of the owner's profile.
    _, owner = make_user()
    public = client.post("/recipes", json=_payload("Adobo", visibility="public"), headers=owner)
    friends = client.post("/recipes", json=_payload("Sinigang", visibility="friends"), headers=owner)
    private = client.post("/recipes", json=_payload("Kare-kare", visibility="private"), headers=owner)
    assert public.status_code == 201 and friends.status_code == 201 and private.status_code == 201

    ids = {r["id"] for r in client.get("/recipes/browse").json()}
    assert public.json()["id"] in ids
    assert friends.json()["id"] not in ids
    assert private.json()["id"] not in ids

    # The owner's profile setting does not change Browse membership — the recipe value is
    # what counts. Flip the profile public: the friends recipe still stays out.
    client.patch("/auth/me", json={"profile_visibility": "public"}, headers=owner)
    ids2 = {r["id"] for r in client.get("/recipes/browse").json()}
    assert public.json()["id"] in ids2
    assert friends.json()["id"] not in ids2


