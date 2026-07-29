"""Demo lead generator — lets the dashboard and analytics be developed and
checked before the real CRM webhook is connected.

It writes through the same ingest path the CRM will use, so whatever works
here works with real webhook traffic.

Usage (backend/ ichida, venv aktiv):
    python seed_leads.py            # 120 ta namunaviy lead
    python seed_leads.py --clear    # avval mavjud demo leadlarni o'chiradi
"""
import random
import sys
from datetime import datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
from app.models import Lead, LeadEvent, LeadStatus
from app.modules.crm_data import ingest_event

SOURCES = [
    "meta_segment_1",
    "meta_segment_2",
    "meta_segment_3",
    "instagram_organik",
    "tavsiya",
    "telegram",
]

REFERRERS = ["Akmal", "Dilshod", "Nodira", "Sardor"]

# Rough real-world funnel: most leads stall early, a minority convert.
PATHS = [
    ([LeadStatus.NEW], 0.10),
    ([LeadStatus.NEW, LeadStatus.CONTACTED], 0.16),
    ([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED], 0.18),
    ([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED, LeadStatus.AWAITING], 0.14),
    (
        [
            LeadStatus.NEW,
            LeadStatus.CONTACTED,
            LeadStatus.QUOTED,
            LeadStatus.AWAITING,
            LeadStatus.CALCULATING,
        ],
        0.10,
    ),
    (
        [
            LeadStatus.NEW,
            LeadStatus.CONTACTED,
            LeadStatus.QUOTED,
            LeadStatus.AWAITING,
            LeadStatus.CALCULATING,
            LeadStatus.WON,
        ],
        0.17,
    ),
    ([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED, LeadStatus.LOST], 0.15),
]


def build_events(crm_id: str, start: datetime) -> list[dict]:
    path = random.choices([p for p, _ in PATHS], weights=[w for _, w in PATHS])[0]
    source = random.choices(SOURCES, weights=[22, 18, 14, 16, 18, 12])[0]
    referral = random.choice(REFERRERS) if source == "tavsiya" else None

    events = []
    when = start
    prev = ""
    for i, status in enumerate(path):
        when = when + timedelta(days=random.randint(1, 6), hours=random.randint(0, 20))
        events.append(
            {
                "event": "lead.created" if i == 0 else "lead.stage_changed",
                "event_id": f"seed_{crm_id}_{i}",
                "occurred_at": when.isoformat(),
                "lead": {
                    "id": crm_id,
                    "created_at": start.isoformat(),
                    "status": status,
                    "previous_status": prev,
                    "source": source,
                    "referral_by": referral,
                    "deal_amount": (
                        round(random.uniform(800, 9000), 2) if status == LeadStatus.WON else None
                    ),
                },
            }
        )
        prev = status
    return events


def main() -> None:
    Base.metadata.create_all(engine)
    clear = "--clear" in sys.argv
    count = 120

    with SessionLocal() as db:
        if clear:
            seeded = db.query(Lead).filter(Lead.crm_id.like("demo-%")).all()
            for lead in seeded:
                db.query(LeadEvent).filter(LeadEvent.lead_id == lead.id).delete()
                db.delete(lead)
            db.commit()
            print(f"{len(seeded)} ta demo lead o'chirildi.")

        if db.query(Lead).filter(Lead.crm_id.like("demo-%")).count():
            print("Demo leadlar allaqachon bor — --clear bilan qayta yarating.")
            return

        now = datetime.now(timezone.utc)
        total_events = 0
        for n in range(count):
            crm_id = f"demo-{n:04d}"
            # spread arrivals over the last ~10 months
            start = now - timedelta(days=random.randint(5, 300))
            for payload in build_events(crm_id, start):
                ingest_event(db, payload)
                total_events += 1

        leads = db.query(Lead).count()
        won = db.query(Lead).filter(Lead.status == LeadStatus.WON).count()
        print(f"Tayyor: {leads} ta lead, {total_events} ta hodisa, {won} tasi sotuvga aylandi.")


if __name__ == "__main__":
    main()
