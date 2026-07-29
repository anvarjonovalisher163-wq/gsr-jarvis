"""Auth guards: every private endpoint rejects anonymous calls."""

GUARDED = [
    "/api/content/plan",
    "/api/dashboard/summary",
    "/api/competitors/",
    "/api/strategy/reports",
    "/api/analytics/report",
    "/api/analytics/roi",
    "/api/crm/health",
    "/api/seasons/upcoming",
    "/api/chat/history",
]


def test_health_is_public(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_guarded_endpoints_require_token(client):
    for path in GUARDED:
        assert client.get(path).status_code == 401, path


def test_bad_login_rejected(client):
    r = client.post("/api/auth/login", json={"login": "owner", "password": "wrong"})
    assert r.status_code == 401


def test_good_login_gives_working_token(client, owner_headers):
    assert client.get("/api/dashboard/summary", headers=owner_headers).status_code == 200
