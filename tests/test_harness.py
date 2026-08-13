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
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}
