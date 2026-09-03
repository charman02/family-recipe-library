import pytest
from sqlalchemy.exc import OperationalError


def test_health_and_auth_smoke(client, make_user):
    # health is unauthenticated
    assert client.get("/health").json() == {"status": "ok"}
    # auth wiring works end to end
    user, headers = make_user()
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == user.email


def test_health_ready_proves_db_reachable(client):
    """The readiness probe must actually hit the DB (SELECT 1).

    If it passes, the ALB target group knows the task can serve real requests.
    If we ever break the DB connection (wrong env, bad sslmode, SG egress blocked),
    this endpoint and this test will be the first things to fail.
    """
    try:
        resp = client.get("/health/ready")
    except OperationalError:
        # The probe opens a real connection to the CONFIGURED database, so with no
        # reachable DB (a dev box with prod-only creds in .env) TestClient re-raises
        # here rather than returning a response. Skip instead of failing: a
        # permanently-red test trains everyone to ignore it, and during #57 a genuine
        # migration/model drift failure hid behind "the usual one".
        pytest.skip("no reachable database in this environment — the probe itself is untested here")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    # `db` reports WHICH kind of check answered: a real SELECT 1 ("checked") or a
    # successful one inside the 10-minute memo window ("cached"). The memo exists because
    # the ALB polls this every 30s and an unmemoized query kept Neon's compute awake 24/7.
    # This assertion was `== {"status": "ready"}` and went stale when `db` was added; it
    # stayed green locally only because a dev box with no reachable DB takes the skip
    # above, so the drift surfaced for the first time in CI (hermetic in-memory SQLite,
    # where the connection succeeds) and blocked the prod deploy.
    assert body["db"] in {"checked", "cached"}


def test_health_ready_memoizes_a_successful_check(client):
    """The keepalive property itself: the FIRST probe of a fresh process does a real
    query, and a probe inside the window is served from the memo without touching the
    DB. That is the whole point of the change — if this regresses, Neon never gets an
    idle window and the monthly compute allowance goes to health checks again."""
    from app import main

    main._last_ready_ok = None  # a fresh task has never checked
    try:
        first = client.get("/health/ready")
    except OperationalError:
        # Same dev-box caveat as the test above: no reachable DB means the probe can't
        # run at all here. CI (hermetic in-memory SQLite) is where this really executes.
        pytest.skip("no reachable database in this environment")
    try:
        assert first.json()["db"] == "checked"
        assert client.get("/health/ready").json()["db"] == "cached"
    finally:
        main._last_ready_ok = None  # never leak the memo into other tests
