"""CRM webhook: auth, idempotency, validation, funnel analytics."""
from datetime import datetime, timedelta, timezone

NOW = datetime.now(timezone.utc)


def _event(event_id, lead_id, status, days_ago=0, prev="", **lead_extra):
    when = NOW - timedelta(days=days_ago)
    return {
        "event": "lead.created" if status == "yangi" else "lead.stage_changed",
        "event_id": event_id,
        "occurred_at": when.isoformat(),
        "lead": {
            "id": lead_id,
            "created_at": (NOW - timedelta(days=days_ago)).isoformat(),
            "status": status,
            "previous_status": prev,
            **lead_extra,
        },
    }


def test_webhook_rejects_wrong_secret(client):
    r = client.post("/api/crm/webhook", json={}, headers={"X-CRM-Secret": "nope"})
    assert r.status_code == 401


def test_lifecycle_and_idempotency(client, crm_headers, owner_headers):
    payload = _event("e1", "L-1", "yangi", days_ago=10, source="meta_segment_1")
    assert client.post("/api/crm/webhook", json=payload, headers=crm_headers).json() == {
        "result": "applied"
    }
    # replayed delivery is ignored
    assert client.post("/api/crm/webhook", json=payload, headers=crm_headers).json() == {
        "result": "duplicate"
    }

    # move through the funnel to won
    for i, (status, prev, days) in enumerate(
        [("boglanildi", "yangi", 8), ("narx_aytildi", "boglanildi", 6), ("mijoz_boldi", "narx_aytildi", 2)]
    ):
        ev = _event(f"e1-{i}", "L-1", status, days_ago=days, prev=prev)
        if status == "mijoz_boldi":
            ev["lead"]["deal_amount"] = 5000
        assert client.post("/api/crm/webhook", json=ev, headers=crm_headers).json()["result"] == "applied"

    rep = client.get("/api/analytics/report", headers=owner_headers).json()
    assert rep["overview"]["won"] >= 1
    assert rep["overview"]["revenue"] >= 5000
    # the won lead reached every stage it passed through
    funnel = {s["status"]: s["reached"] for s in rep["funnel"]}
    assert funnel["mijoz_boldi"] >= 1
    assert funnel["yangi"] >= funnel["mijoz_boldi"]


def test_unknown_status_is_400(client, crm_headers):
    r = client.post(
        "/api/crm/webhook",
        json=_event("e-bad", "L-2", "qandaydir_status"),
        headers=crm_headers,
    )
    assert r.status_code == 400


def test_missing_lead_id_is_400(client, crm_headers):
    r = client.post(
        "/api/crm/webhook", json={"event": "lead.created", "lead": {}}, headers=crm_headers
    )
    assert r.status_code == 400


def test_backfill_survives_bad_rows(client, crm_headers):
    events = [_event(f"bf-{i}", f"BF-{i}", "yangi", days_ago=30 + i) for i in range(3)]
    events.append({"event": "nonsense"})
    body = client.post(
        "/api/crm/backfill", json={"events": events}, headers=crm_headers
    ).json()
    assert body["applied"] == 3
    assert body["failed"] == 1


def test_stale_leads_listed(client, crm_headers, owner_headers):
    client.post(
        "/api/crm/webhook",
        json=_event("e-stale", "L-stale", "yangi", days_ago=40, source="telegram"),
        headers=crm_headers,
    )
    stale = client.get("/api/analytics/stale?days=14", headers=owner_headers).json()
    assert any(item["crm_id"] == "L-stale" for item in stale["items"])
