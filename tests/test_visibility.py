def _payload(name="Adobo", **extra):
    return {
        "name": name,
        "ingredients": [
            {"name": "chicken", "quantity_text": "2 lbs", "quantity_type": "precise", "position": 1}
        ],
        "steps": [{"content": "Cook", "position": 1}],
        **extra,
    }


def test_create_defaults_public(client, make_user):
    # Default flipped to public so new recipes seed the Browse feed; the author
    # can opt down to "Only me" in the create-time visibility choice.
    _, headers = make_user()
    r = client.post("/recipes", json=_payload(), headers=headers)
    assert r.status_code == 201
    assert r.json()["visibility"] == "public"


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


def test_browse_membership_is_decided_by_the_create_payload(client, make_user):
    # The add-recipe flow's lever on Browse is the `visibility` it POSTs. Pin it
    # end-to-end in both directions: a recipe left at the (now public) default
    # appears in Browse, and one explicitly opted down to private does not. The
    # default is now public specifically so the feed isn't empty for everyone.
    _, owner = make_user()
    default = client.post("/recipes", json=_payload("Sinigang"), headers=owner)
    private = client.post("/recipes", json=_payload("Kare-kare", visibility="private"), headers=owner)
    assert default.status_code == 201 and private.status_code == 201
    assert default.json()["visibility"] == "public"

    ids = {r["id"] for r in client.get("/recipes/browse").json()}
    assert default.json()["id"] in ids
    assert private.json()["id"] not in ids


