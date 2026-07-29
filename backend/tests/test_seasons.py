"""Seasonal calendar logic — deterministic, no network."""
from datetime import date

from app.modules import seasons


def test_cny_2026_signal_window():
    # 40 days before CNY 2026 (Feb 17) the 45-day campaign window is open
    today = date(2026, 1, 8)
    signals = seasons.active_signals(today)
    names = [s["name"] for s in signals]
    assert any("Yangi yili" in n for n in names)
    cny = next(s for s in signals if "Yangi yili" in s["name"])
    assert cny["days_left"] == 40
    assert cny["active"] is True


def test_far_event_listed_but_not_active():
    # 80 days before Golden Week (Oct 1): visible in upcoming, not yet active
    today = date(2026, 7, 13)
    upcoming = seasons.upcoming(today, horizon_days=90)
    gw = next(e for e in upcoming if "Oltin hafta" in e["name"])
    assert gw["active"] is False


def test_year_boundary():
    # late December must see CNY of the NEXT year
    today = date(2026, 12, 20)
    upcoming = seasons.upcoming(today, horizon_days=90)
    assert any(e["date"].startswith("2027") for e in upcoming)


def test_prompt_block_empty_when_quiet():
    # a date with no active windows produces no prompt text
    today = date(2026, 3, 10)
    assert seasons.prompt_lines(today) == ""


def test_prompt_block_present_when_active():
    today = date(2026, 1, 20)
    block = seasons.prompt_lines(today)
    assert "MAVSUMIY SIGNALLAR" in block
    assert "Yangi yili" in block


def test_endpoint(client, owner_headers):
    r = client.get("/api/seasons/upcoming?horizon=365", headers=owner_headers)
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 4
    assert all({"name", "date", "days_left", "active"} <= set(e) for e in events)
