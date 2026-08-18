"""GET /recipes/field-suggestions — the user's own past "Passed down from" (source)
and "Cuisine" values, for the add-form autosuggest.

Same story as ingredient-suggestions: the value is a trace of what THIS user typed,
so SCOPE is the security property. These pin that boundary plus ordering and the
source-name extraction from origin_attribution.
"""


def _recipe(client, headers, name, *, source=None, cuisine=None, visibility="private"):
    payload = {"name": name, "visibility": visibility, "steps": [{"content": "Cook", "position": 1}]}
    if source is not None:
        payload["origin"] = {"name": source}
    if cuisine is not None:
        payload["cuisine"] = cuisine
    r = client.post("/recipes", json=payload, headers=headers)
    assert r.status_code == 201
    return r.json()


def test_suggests_the_users_own_sources_and_cuisines(client, make_user):
    _, headers = make_user()
    _recipe(client, headers, "Adobo", source="Lola", cuisine="Filipino")
    _recipe(client, headers, "Sinigang", source="Tita Bing", cuisine="Filipino")
    body = client.get("/recipes/field-suggestions", headers=headers).json()
    assert "Lola" in body["sources"]
    assert "Tita Bing" in body["sources"]
    assert "Filipino" in body["cuisines"]


def test_most_used_first(client, make_user):
    _, headers = make_user()
    _recipe(client, headers, "A", cuisine="Filipino")
    _recipe(client, headers, "B", cuisine="Filipino")
    _recipe(client, headers, "C", cuisine="Thai")
    body = client.get("/recipes/field-suggestions", headers=headers).json()
    # Filipino used twice, Thai once → Filipino ranks first.
    assert body["cuisines"][0] == "Filipino"


def test_extracts_only_the_name_from_origin_attribution(client, make_user):
    # origin_attribution is stored as "Name · place/year"; the source field holds
    # just the name, so the suggestion must be the leading segment only.
    _, headers = make_user()
    client.post(
        "/recipes",
        json={
            "name": "Adobo",
            "origin": {"name": "Lola Remedios", "place": "Cebu"},
            "steps": [{"content": "Cook", "position": 1}],
        },
        headers=headers,
    )
    body = client.get("/recipes/field-suggestions", headers=headers).json()
    assert "Lola Remedios" in body["sources"]
    # The place must not ride along in the suggestion.
    assert not any("Cebu" in s for s in body["sources"])


def test_scope_excludes_other_users(client, make_user):
    _, mine = make_user()
    _, theirs = make_user()
    _recipe(client, theirs, "Theirs", source="Someone Else", cuisine="Korean")
    _recipe(client, mine, "Mine", source="My Lola", cuisine="Filipino")
    body = client.get("/recipes/field-suggestions", headers=mine).json()
    assert "My Lola" in body["sources"]
    assert "Someone Else" not in body["sources"]
    assert "Korean" not in body["cuisines"]  # another user's cuisine must not leak


def test_empty_and_deleted_are_ignored(client, make_user):
    _, headers = make_user()
    _recipe(client, headers, "No source no cuisine")  # neither set
    r = _recipe(client, headers, "Deleted", source="Ghost", cuisine="Ghost Cuisine")
    client.delete(f"/recipes/{r['id']}", headers=headers)
    body = client.get("/recipes/field-suggestions", headers=headers).json()
    assert body["sources"] == []
    assert body["cuisines"] == []


def test_path_is_not_captured_by_get_recipe(client, make_user):
    # The literal /field-suggestions route must win over /{recipe_id}.
    _, headers = make_user()
    r = client.get("/recipes/field-suggestions", headers=headers)
    assert r.status_code == 200
    assert "sources" in r.json() and "cuisines" in r.json()


def test_requires_auth(client, make_user):
    assert client.get("/recipes/field-suggestions").status_code == 401
