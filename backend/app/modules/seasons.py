"""Seasonal forecast calendar — Chinese holidays and shopping festivals that
move freight demand on the China-Uzbekistan lane.

Fully deterministic (no AI, no network). Used three ways:
  * the weekly content plan prompt gets active signals injected, so Jarvis
    writes "hozir buyurtma bering" posts ahead of factory shutdowns;
  * a weekly push reminds the owner of approaching windows;
  * the Shtab tab shows the upcoming list.

Lunar-calendar dates are table-driven per year. The table currently covers
2026-2028 — EXTEND IT each year (a missing year silently drops the event,
it does not error).
"""
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class SeasonEvent:
    name: str
    event_date: date
    lead_days: int          # start the campaign this many days before
    note: str               # what happens logistically
    cta: str                # the marketing angle


# Fixed-date events, every year: (month, day, name, lead_days, note, cta)
FIXED = [
    (5, 1, "Xitoy Mehnat bayrami (1-5 may)", 14,
     "Zavod va omborlar ~5 kun ishlamaydi, jo'natishlar siljiydi.",
     "Aprel oxirigacha buyurtma berishga chaqiruvchi post."),
    (6, 18, "618 savdo festivali", 21,
     "Xitoy ichki savdosi avjida — liniyalar band, joy kamayadi.",
     "Marketplace sotuvchilarga: tovarni oldindan band qiling."),
    (10, 1, "Oltin hafta (1-8 oktyabr)", 30,
     "Milliy bayram: zavodlar ~1 hafta yopiq, oldin-keyin tirbandlik.",
     "Sentyabr boshida 'Oltin haftagacha ulguring' kampaniyasi."),
    (11, 11, "11.11 (Yakkalar kuni)", 30,
     "Yilning eng katta savdo kuni — kargo hajmi keskin oshadi.",
     "Oktyabrda joy band qilishga chaqiruvchi kontent."),
    (12, 12, "12.12 savdo festivali", 21,
     "Yil oxiri savdo to'lqini, Yangi yil oldi tirbandlik boshlanadi.",
     "Yangi yilgacha yetib kelishini kafolatlash taklifi."),
]

# Lunar-calendar events: name -> (per-year date table, lead_days, note, cta)
LUNAR = {
    "Xitoy Yangi yili (Bahor bayrami)": (
        {2026: date(2026, 2, 17), 2027: date(2027, 2, 6), 2028: date(2028, 1, 26)},
        45,
        "Zavodlar ~2-3 hafta yopiladi, undan oldin narx va tirbandlik cho'qqisi.",
        "45 kun oldin: 'Bayramgacha ulgurish uchun hoziroq buyurtma bering'.",
    ),
    "Ajdaho qayig'i bayrami": (
        {2026: date(2026, 6, 19), 2027: date(2027, 6, 9), 2028: date(2028, 5, 28)},
        14,
        "3 kunlik dam olish, jo'natishlar biroz siljiydi.",
        "Kichik eslatma-post: muddatlarni hisobga oling.",
    ),
    "Kuz o'rtasi bayrami": (
        {2026: date(2026, 9, 25), 2027: date(2027, 9, 15), 2028: date(2028, 10, 3)},
        14,
        "Oltin hafta bilan tutashsa uzun tanaffus bo'ladi.",
        "Oltin hafta kampaniyasi bilan birga yuritiladi.",
    ),
}


def events_for_year(year: int) -> list[SeasonEvent]:
    events = [
        SeasonEvent(name, date(year, month, day), lead, note, cta)
        for month, day, name, lead, note, cta in FIXED
    ]
    for name, (table, lead, note, cta) in LUNAR.items():
        if year in table:
            events.append(SeasonEvent(name, table[year], lead, note, cta))
    return events


def upcoming(today: date | None = None, horizon_days: int = 90) -> list[dict]:
    """Events within the horizon, soonest first. `active` means the campaign
    window is open (days_left <= lead_days) — time to publish."""
    today = today or date.today()
    out = []
    for year in (today.year, today.year + 1):
        for ev in events_for_year(year):
            days_left = (ev.event_date - today).days
            if 0 <= days_left <= horizon_days:
                out.append(
                    {
                        "name": ev.name,
                        "date": ev.event_date.isoformat(),
                        "days_left": days_left,
                        "lead_days": ev.lead_days,
                        "active": days_left <= ev.lead_days,
                        "note": ev.note,
                        "cta": ev.cta,
                    }
                )
    return sorted(out, key=lambda e: e["days_left"])


def active_signals(today: date | None = None) -> list[dict]:
    return [e for e in upcoming(today) if e["active"]]


def prompt_lines(today: date | None = None) -> str:
    """Seasonal block injected into the weekly content plan prompt. Empty
    string when no campaign window is open."""
    signals = active_signals(today)
    if not signals:
        return ""
    lines = [
        f"- {s['name']}: {s['days_left']} kun qoldi ({s['date']}). {s['note']} "
        f"Marketing burchagi: {s['cta']}"
        for s in signals
    ]
    return (
        "\nMAVSUMIY SIGNALLAR (majburiy hisobga olinsin):\n"
        + "\n".join(lines)
        + "\nKamida bitta post shu signalga bog'lansin — mijozni hozir "
        "buyurtma berishga undaydigan aniq muddatli taklif bilan."
    )
