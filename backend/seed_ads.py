"""Demo Meta Ads spend — lets the ROI screen be built and checked before the
real ads_read token arrives.

Rows are written through the same store_rows() path the live sync uses, and
the payload shape matches what the Marketing API returns, so switching to
real data changes nothing but the source of the rows.

Usage (backend/ ichida, venv aktiv):
    python seed_ads.py
    python seed_ads.py --clear
"""
import random
import sys
from datetime import date, timedelta

from app.database import Base, SessionLocal, engine
from app.models import AdSpend
from app.modules.meta_ads import store_rows

# The first three follow the naming convention (ad set name matches the CRM
# lead source once punctuation and case are stripped). The fourth does not —
# it is here on purpose so the "unmatched" reporting is visible in the demo.
ADSETS = [
    ("2301", "Meta Segment 1", 0.9),
    ("2302", "Meta Segment 2", 1.2),
    ("2303", "Meta Segment 3", 0.7),
    ("2304", "Retargeting — 30 kun", 0.5),
]

CAMPAIGN = ("9001", "ABO — Xitoy yuk tashish")


def main() -> None:
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        if "--clear" in sys.argv:
            n = db.query(AdSpend).delete()
            db.commit()
            print(f"{n} ta xarajat yozuvi o'chirildi.")
            return

        if db.query(AdSpend).count():
            print("Xarajat ma'lumoti allaqachon bor — --clear bilan qayta yarating.")
            return

        today = date.today()
        rows = []
        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            for adset_id, adset_name, weight in ADSETS:
                spend = round(random.uniform(8, 26) * weight, 2)
                impressions = int(spend * random.uniform(180, 340))
                clicks = int(impressions * random.uniform(0.01, 0.03))
                rows.append(
                    {
                        "date_start": day.isoformat(),
                        "campaign_id": CAMPAIGN[0],
                        "campaign_name": CAMPAIGN[1],
                        "adset_id": adset_id,
                        "adset_name": adset_name,
                        "spend": str(spend),
                        "impressions": str(impressions),
                        "clicks": str(clicks),
                        "actions": [
                            {"action_type": "lead", "value": str(max(0, int(clicks * 0.12)))}
                        ],
                        "account_currency": "USD",
                    }
                )

        result = store_rows(db, rows)
        total = db.query(AdSpend).count()
        print(f"Tayyor: {total} ta kunlik yozuv ({result['created']} yangi).")


if __name__ == "__main__":
    main()
