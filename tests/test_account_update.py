# PATCH /auth/me — editing the signed-in account (name, email, password).
#
# The rules under test: a name edit is low-risk (no password); email and password
# changes require the correct current_password because they alter the login
# identity; email must stay unique; and only the fields sent are touched.
#
# The fixture's users are created with password "password123".


def test_edit_name_needs_no_password(client, make_user):
    _, headers = make_user()
    r = client.patch(
        "/auth/me",
        json={"first_name": "Remedios", "last_name": "Santos"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["first_name"] == "Remedios"
    assert body["last_name"] == "Santos"


def test_blank_name_is_rejected(client, make_user):
    # A byline can't become nothing — same rule as signup (strip then require ≥1).
    _, headers = make_user()
    r = client.patch("/auth/me", json={"first_name": "   "}, headers=headers)
    assert r.status_code == 422


def test_change_email_with_correct_password(client, make_user):
    _, headers = make_user()
    r = client.patch(
        "/auth/me",
        json={"email": "new@example.com", "current_password": "password123"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["email"] == "new@example.com"


def test_change_email_needs_the_current_password(client, make_user):
    _, headers = make_user()
    # No password at all.
    r = client.patch("/auth/me", json={"email": "x@example.com"}, headers=headers)
    assert r.status_code == 400
    # Wrong password.
    r = client.patch(
        "/auth/me",
        json={"email": "x@example.com", "current_password": "wrong"},
        headers=headers,
    )
    assert r.status_code == 400


def test_email_must_be_unique(client, make_user):
    first, _ = make_user()  # user1@example.com
    _, headers2 = make_user()  # user2@example.com
    r = client.patch(
        "/auth/me",
        json={"email": first.email, "current_password": "password123"},
        headers=headers2,
    )
    assert r.status_code == 400
    assert "already in use" in r.json()["detail"].lower()


def test_setting_email_to_its_own_value_is_a_no_op(client, make_user):
    # Re-sending the current email must not trip the uniqueness check against self,
    # and (since it isn't a change) shouldn't even require the password.
    user, headers = make_user()
    r = client.patch("/auth/me", json={"email": user.email}, headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == user.email


def test_change_password_then_log_in_with_it(client, make_user):
    user, headers = make_user()
    r = client.patch(
        "/auth/me",
        json={"new_password": "brand-new-pw", "current_password": "password123"},
        headers=headers,
    )
    assert r.status_code == 200
    # The new password works...
    ok = client.post(
        "/auth/login",
        data={"username": user.email, "password": "brand-new-pw"},
    )
    assert ok.status_code == 200
    # ...and the old one no longer does.
    no = client.post(
        "/auth/login",
        data={"username": user.email, "password": "password123"},
    )
    assert no.status_code == 401


def test_change_password_needs_the_current_password(client, make_user):
    _, headers = make_user()
    r = client.patch(
        "/auth/me",
        json={"new_password": "brand-new-pw", "current_password": "wrong"},
        headers=headers,
    )
    assert r.status_code == 400


def test_short_new_password_is_rejected(client, make_user):
    _, headers = make_user()
    r = client.patch(
        "/auth/me",
        json={"new_password": "short", "current_password": "password123"},
        headers=headers,
    )
    assert r.status_code == 422


def test_patch_me_requires_auth(client):
    r = client.patch("/auth/me", json={"first_name": "Nobody"})
    assert r.status_code == 401
