"""GET /recipes/ingredient-suggestions — the user's own ingredient vocabulary.

The autosuggest exists to cut typing in the add flow, but its source is a list of
things a person has cooked, which makes SCOPE the whole story: a suggestion that
came from someone else's recipe leaks their kitchen into your keyboard. These
tests pin that boundary alongside the ordering and path-routing behaviour.
"""


def _recipe(client, headers, name, ingredient_names, visibility="private"):
    payload = {
        "name": name,
        "visibility": visibility,
        "ingredients": [
            {
                "name": n,
                "quantity_text": "1 tbsp",
                "quantity_type": "precise",
                "position": i + 1,
            }
            for i, n in enumerate(ingredient_names)
        ],
        "steps": [{"content": "Cook it", "position": 1}],
    }
    r = client.post("/recipes", json=payload, headers=headers)
    assert r.status_code == 201
    return r.json()


def test_suggests_the_users_own_ingredients(client, make_user):
    _, headers = make_user()
    _recipe(client, headers, "Adobo", ["soy sauce", "bay leaves"])

    r = client.get("/recipes/ingredient-suggestions", headers=headers)
    assert r.status_code == 200
    assert set(r.json()["names"]) == {"soy sauce", "bay leaves"}


def test_never_leaks_another_users_private_ingredients(client, make_user):
    # THE test. Two accounts, no relationship between them: nothing the second
    # cook typed may ever appear in the first cook's autosuggest.
    _, mine = make_user()
    _, theirs = make_user()
    _recipe(client, mine, "Adobo", ["soy sauce"])
    _recipe(client, theirs, "Kimchi Jjigae", ["gochugaru", "doenjang"])

    names = client.get("/recipes/ingredient-suggestions", headers=mine).json()["names"]
    assert names == ["soy sauce"]
    assert "gochugaru" not in names
    assert "doenjang" not in names


def test_does_not_suggest_from_a_public_recipe_of_another_user(client, make_user):
    # A deliberate choice, not an oversight: the recipe body is readable to
    # anyone, but suggesting its words as if they were yours turns a browsable
    # page into an inferred profile of what that person cooks. Readable != mine.
    _, mine = make_user()
    _, theirs = make_user()
    _recipe(client, theirs, "Public Congee", ["century egg"], visibility="public")

    names = client.get("/recipes/ingredient-suggestions", headers=mine).json()["names"]
    assert names == []


def test_does_not_suggest_from_a_recipe_handed_off_to_me(client, make_user):
    # Same rule at the friendliest possible boundary: someone chose to hand me
    # this dish and I can read every word of it, yet its ingredients still aren't
    # my vocabulary. Only what I typed is.
    me, mine = make_user()
    _, theirs = make_user()
    shared = _recipe(client, theirs, "Sinigang", ["tamarind paste"])
    client.post(f"/recipes/{shared['id']}/handoff", json={"to_user_id": me.id}, headers=theirs)
    # Confirm the grant really is readable, so the assertion below is about scope
    # rather than about a handoff that silently failed.
    assert client.get(f"/recipes/{shared['id']}", headers=mine).status_code == 200

    names = client.get("/recipes/ingredient-suggestions", headers=mine).json()["names"]
    assert "tamarind paste" not in names


def test_excludes_soft_deleted_recipes(client, make_user):
    _, headers = make_user()
    keep = _recipe(client, headers, "Adobo", ["soy sauce"])
    gone = _recipe(client, headers, "Draft", ["mystery powder"])
    assert client.delete(f"/recipes/{gone['id']}", headers=headers).status_code == 204

    names = client.get("/recipes/ingredient-suggestions", headers=headers).json()["names"]
    assert names == ["soy sauce"]


def test_dedupes_case_insensitively_and_orders_by_use(client, make_user):
    _, headers = make_user()
    _recipe(client, headers, "One", ["Soy Sauce", "ginger"])
    _recipe(client, headers, "Two", ["soy sauce", "scallions"])
    _recipe(client, headers, "Three", ["soy sauce"])

    names = client.get("/recipes/ingredient-suggestions", headers=headers).json()["names"]
    # Three uses across two spellings collapse to one entry, and the word this
    # cook reaches for most sorts first so it's the least typing.
    assert names[0].lower() == "soy sauce"
    assert sum(1 for n in names if n.lower() == "soy sauce") == 1
    assert set(n.lower() for n in names) == {"soy sauce", "ginger", "scallions"}


def test_requires_authentication(client, make_user):
    assert client.get("/recipes/ingredient-suggestions").status_code == 401


def test_literal_path_is_not_captured_as_a_recipe_id(client, make_user):
    # /recipes/{recipe_id} would otherwise match with recipe_id="ingredient-
    # suggestions" and answer 422. Empty kitchen → empty list, not an error.
    _, headers = make_user()
    r = client.get("/recipes/ingredient-suggestions", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"names": []}
