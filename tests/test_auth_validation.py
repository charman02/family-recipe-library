"""Signup input rules, and the two security properties of /auth that are
deliberate and must not drift.

The name rules exist because a byline is load-bearing in this product: every
recipe renders "from {name}", so an account with a blank name puts a dish on
the shelf with no one attached to it. That has to be impossible at the door —
there's no repair path once recipes are hanging off the account.
"""

import pytest


def _signup(client, **overrides):
    payload = {
        "email": "new@example.com",
        "password": "password123",
        "first_name": "Mia",
        "last_name": "Tan",
    }
    payload.update(overrides)
    return client.post("/auth/signup", json=payload)


# --- Names ---------------------------------------------------------------


@pytest.mark.parametrize("field", ["first_name", "last_name"])
@pytest.mark.parametrize(
    "value",
    [
        "",  # nothing typed
        "   ",  # spacebar only — passes a browser's `required`, renders as nothing
        "\t\n ",  # whitespace that isn't a space
    ],
    ids=["empty", "spaces", "other-whitespace"],
)
def test_blank_name_is_rejected(client, field, value):
    resp = _signup(client, **{field: value})
    assert resp.status_code == 422
    # The field is named in the error so the client can point at the right input.
    assert any(field in e["loc"] for e in resp.json()["detail"])


@pytest.mark.parametrize("field", ["first_name", "last_name"])
def test_overlong_name_is_rejected(client, field):
    resp = _signup(client, **{field: "A" * 81})
    assert resp.status_code == 422
    assert any(field in e["loc"] for e in resp.json()["detail"])


@pytest.mark.parametrize("field", ["first_name", "last_name"])
def test_name_at_the_limit_is_accepted(client, field):
    # 80 is the boundary, not a value one past it — a long multi-part name is a
    # real name, not an attack.
    resp = _signup(client, **{field: "A" * 80})
    assert resp.status_code == 201


def test_names_are_trimmed_before_storage(client):
    # A trailing space off a phone keyboard would otherwise ride into every
    # byline this account's recipes carry.
    resp = _signup(client, first_name="  Mia  ", last_name="\tTan ")
    assert resp.status_code == 201
    body = resp.json()
    assert body["first_name"] == "Mia"
    assert body["last_name"] == "Tan"


def test_a_name_with_internal_spaces_survives_trimming(client):
    # Trimming is edges-only: "Ana Maria" and "van der Berg" are single names.
    resp = _signup(client, first_name=" Ana Maria ", last_name="van der Berg")
    assert resp.status_code == 201
    assert resp.json()["first_name"] == "Ana Maria"
    assert resp.json()["last_name"] == "van der Berg"


# --- Password ------------------------------------------------------------


def test_short_password_is_rejected(client):
    resp = _signup(client, password="pw12345")  # 7
    assert resp.status_code == 422
    assert any("password" in e["loc"] for e in resp.json()["detail"])


def test_overlong_password_is_rejected(client):
    # Past bcrypt's 72-byte ceiling the tail is silently ignored, so accepting it
    # would mean accepting a password we don't actually verify in full.
    resp = _signup(client, password="p" * 73)
    assert resp.status_code == 422
    assert any("password" in e["loc"] for e in resp.json()["detail"])


def test_password_at_the_minimum_is_accepted(client):
    assert _signup(client, password="pw123456").status_code == 201


# --- Email ---------------------------------------------------------------


@pytest.mark.parametrize(
    "email", ["notanemail", "mia@", "@example.com", "mia@example", "mia example@x.com"]
)
def test_malformed_email_is_rejected(client, email):
    resp = _signup(client, email=email)
    assert resp.status_code == 422
    assert any("email" in e["loc"] for e in resp.json()["detail"])


# --- The 422 shape the frontend has to render ---------------------------


def test_validation_failure_detail_is_a_list_of_objects_with_loc_and_msg(client):
    """Pins the contract the frontend normalizer is written against.

    FastAPI answers a schema failure with `detail` as an array of objects, not a
    string. Rendering it as-is is what put "[object Object]" in front of users
    who chose a short password (fixed in frontend/src/api/client.js). If this
    shape ever changes, that normalizer needs to change with it.
    """
    resp = _signup(client, password="pw1", first_name=" ")
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert isinstance(detail, list) and len(detail) >= 2
    for entry in detail:
        assert isinstance(entry, dict)
        assert "loc" in entry and "msg" in entry


# --- Security properties to PRESERVE ------------------------------------


def test_login_does_not_reveal_whether_an_email_exists(client, make_user):
    """Login must stay non-enumerating.

    A different message (or status) for "no such account" vs "wrong password"
    turns the login form into a membership oracle: anyone can test an email
    against it and learn whether that person has an issei account. The response
    for both must be byte-identical.
    """
    user, _ = make_user()

    wrong_password = client.post(
        "/auth/login", data={"username": user.email, "password": "notthepassword"}
    )
    unknown_email = client.post(
        "/auth/login", data={"username": "nobody@example.com", "password": "notthepassword"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    body = wrong_password.json()["detail"]
    # And the copy itself must not name which half failed.
    assert body == "Invalid email or password"
    assert "registered" not in body.lower()
    assert "not found" not in body.lower()
    assert user.email not in body


def test_signup_still_reports_a_taken_email(client):
    """The deliberate asymmetry: signup DOES reveal an existing email.

    It's enumerable in principle, but the alternative — "check your email" for an
    address that already has an account — leaves a returning user who forgot they
    signed up stuck with no way forward. Kept on purpose; see the report.
    """
    assert _signup(client).status_code == 201
    again = _signup(client)
    assert again.status_code == 400
    assert again.json()["detail"] == "Email already registered"


def test_signup_still_auto_accepts_a_pending_invite_after_the_new_name_rules(
    client, make_user, db_session
):
    """The name rules must not disturb the handoff auto-accept.

    Signup does double duty: it also claims any pending invite addressed to the
    new email (sharing spec §4.2). This covers the trimmed-name path specifically
    — the schema now rewrites first_name/last_name on the way in, and the invite
    match is on email, so a regression here would be silent.
    """
    from app.models.handoff import Handoff

    owner, oheaders = make_user()
    recipe = client.post(
        "/recipes",
        json={"name": "Adobo", "ingredient_sections": [], "steps": []},
        headers=oheaders,
    ).json()
    client.post(
        f"/recipes/{recipe['id']}/handoff",
        json={"to_email": "invited@example.com"},
        headers=oheaders,
    )

    resp = _signup(client, email="invited@example.com", first_name="  Mia  ")
    assert resp.status_code == 201
    assert resp.json()["first_name"] == "Mia"

    handoff = (
        db_session.query(Handoff)
        .filter_by(recipe_id=recipe["id"], to_email="invited@example.com")
        .one()
    )
    assert handoff.state == "accepted"
    assert handoff.to_user_id is not None
