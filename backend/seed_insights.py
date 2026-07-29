"""Demo Instagram Insights data — lets the page-statistics section be built
and checked before the real token arrives. Written through the same
store_rows() path the live sync uses.

Usage (backend/ ichida, venv aktiv):
    python seed_insights.py
    python seed_insights.py --clear
"""
import random
import sys
from datetime import date, timedelta

from app.database import Base, SessionLocal, engine
from app.models import PageInsight
from app.modules.page_insights import store_rows


def main() -> None:
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        if "--clear" in sys.argv:
            n = db.query(PageInsight).delete()
            db.commit()
            print(f"{n} ta insights yozuvi o'chirildi.")
            return

        if db.query(PageInsight).count():
            print("Insights ma'lumoti allaqachon bor — --clear bilan qayta yarating.")
            return

        today = date.today()
        per_day = {}
        followers = 3380
        for offset in range(29, -1, -1):
            day = today - timedelta(days=offset)
            reach = random.randint(350, 1600)
            # weekends dip, spikes on "post days"
            if day.weekday() in (1, 3):
                reach = int(reach * 1.6)
            per_day[day] = {
                "reach": reach,
                "profile_views": int(reach * random.uniform(0.03, 0.07)),
                "website_clicks": int(reach * random.uniform(0.005, 0.015)),
            }
            followers += random.randint(0, 9)

        result = store_rows(db, per_day, followers)
        print(f"Tayyor: {result['created']} kunlik yozuv, obunachi: {followers}.")


if __name__ == "__main__":
    main()
