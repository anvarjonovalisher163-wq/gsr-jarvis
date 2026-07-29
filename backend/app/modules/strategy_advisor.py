"""Module C — Sales Strategy Advisor.

Monthly: reviews stored metrics and proposes next-month tactics.
On-demand: answers any marketing question with GSR context.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..claude_client import ask
from ..models import Competitor, CompetitorPost, ContentPost, IntelReport, PostStatus, StrategyReport, utcnow
from . import analytics, page_insights, seasons

log = logging.getLogger(__name__)


def collect_metrics(db: Session) -> str:
    """Compact metrics block injected into strategy prompts."""
    month_start = date.today().replace(day=1)

    published_total = db.scalar(
        select(func.count()).select_from(ContentPost).where(ContentPost.status == PostStatus.PUBLISHED)
    ) or 0
    published_month = db.scalar(
        select(func.count())
        .select_from(ContentPost)
        .where(ContentPost.status == PostStatus.PUBLISHED, ContentPost.week_start >= month_start)
    ) or 0
    pending = db.scalar(
        select(func.count())
        .select_from(ContentPost)
        .where(ContentPost.status.in_([PostStatus.REVIEW, PostStatus.DRAFT, PostStatus.IDEA]))
    ) or 0
    approved = db.scalar(
        select(func.count()).select_from(ContentPost).where(ContentPost.status == PostStatus.APPROVED)
    ) or 0
    competitors = db.scalar(select(func.count()).select_from(Competitor)) or 0
    comp_posts_30d = db.scalar(
        select(func.count())
        .select_from(CompetitorPost)
        .where(CompetitorPost.fetched_at >= utcnow() - timedelta(days=30))
    ) or 0

    pillar_rows = db.execute(
        select(ContentPost.pillar, func.count())
        .where(ContentPost.status == PostStatus.PUBLISHED)
        .group_by(ContentPost.pillar)
        .order_by(func.count().desc())
        .limit(5)
    ).all()
    pillar_lines = "\n".join(f"  - {p or '(nomsiz)'}: {c} ta" for p, c in pillar_rows) or "  - hali yo'q"

    last_intel = db.scalars(select(IntelReport).order_by(IntelReport.id.desc()).limit(1)).first()
    intel_excerpt = (last_intel.summary[:1200] + "…") if last_intel and len(last_intel.summary) > 1200 else (
        last_intel.summary if last_intel else "hali mavjud emas"
    )

    # --- Lead funnel and ad ROI (module 2) ---
    ov = analytics.overview(db)
    lead_lines = "hali CRM ulanmagan"
    if ov["total"]:
        fn = analytics.funnel(db)
        worst = max(fn[:-1], key=lambda s: s["dropped_here"], default=None)
        stale = analytics.stale_leads(db)
        cycle = analytics.cycle_time(db)
        worst_line = (
            f"{worst['label']} ({worst['drop_pct']}% yo'qoladi)" if worst else "aniqlanmadi"
        )
        avg_days = cycle["avg_days"] if cycle["avg_days"] is not None else "noma'lum"
        lead_lines = (
            f"jami {ov['total']} ta lid, {ov['won']} tasi mijoz bo'ldi "
            f"(konversiya {ov['conversion_pct']}%), jarayonda {ov['in_progress']} ta.\n"
            f"  Eng katta yo'qotish bosqichi: {worst_line}. "
            f"Sovigan lidlar: {stale['count']} ta. "
            f"O'rtacha savdo tsikli: {avg_days} kun."
        )

    roi = analytics.roi(db, 30)
    if roi["segments"]:
        seg_lines = "\n".join(
            f"  - {s['segment']}: sarf {s['spend']} {roi['currency']}, {s['crm_leads']} lid, "
            f"{s['won']} sotuv, bitta sotuv narxi {s['cost_per_sale'] or 'hisoblanmadi'}"
            for s in roi["segments"][:6]
        )
        roi_lines = f"so'nggi 30 kunda jami {roi['total_spend']} {roi['currency']}:\n{seg_lines}"
    else:
        roi_lines = "reklama xarajati hali ulanmagan"

    ig = page_insights.summary(db)
    ig_line = (
        f"{ig['followers']} obunachi, 30 kunlik qamrov {ig['reach_total']}, "
        f"profil ko'rishlar {ig['profile_views_total']}"
        if ig["daily"]
        else "hali ulanmagan"
    )

    season_list = seasons.upcoming(horizon_days=60)
    season_lines = (
        "\n".join(f"  - {s['name']}: {s['days_left']} kun qoldi" for s in season_list[:4])
        or "  - yaqin 60 kunda muhim sana yo'q"
    )

    return (
        "ICHKI METRIKALAR:\n"
        f"- Lidlar (CRM): {lead_lines}\n"
        f"- Reklama ROI (ABO segmentlar): {roi_lines}\n"
        f"- Instagram sahifamiz: {ig_line}\n"
        f"- Jami joylangan postlar: {published_total} (shu oyda: {published_month})\n"
        f"- Tasdiqlangan, joylanmagan: {approved}; ko'rib chiqilayotgan: {pending}\n"
        f"- Kuzatilayotgan raqobatchilar: {competitors} (30 kunda yig'ilgan postlari: {comp_posts_30d})\n"
        f"- Eng ko'p joylangan kontent ustunlari:\n{pillar_lines}\n"
        f"- Yaqinlashayotgan mavsumiy sanalar:\n{season_lines}\n"
        f"- So'nggi raqobat tahlili:\n{intel_excerpt}"
    )


async def run_monthly_strategy(db: Session) -> StrategyReport:
    """Generate next-month tactics and persist the report."""
    next_month = (date.today().replace(day=1) + timedelta(days=32)).replace(day=1)
    metrics = collect_metrics(db)

    prompt = (
        f"{metrics}\n\n"
        f"Yuqoridagi metrikalar asosida {next_month.strftime('%Y-%m')} oyi uchun marketing "
        "taktikalarini taklif qil. Bo'limlar:\n"
        "1. Asosiy maqsad va kutilayotgan natija (raqamlar bilan)\n"
        "2. Aksiyalar — masalan, birinchi jo'natmaga chegirma kabi 2-3 ta aniq taklif\n"
        "3. Lead-magnitlar — qanday bepul qiymat berib lead yig'amiz\n"
        "4. Kontent yo'nalishi — qaysi ustunlarga urg'u beramiz\n"
        "5. Meta Ads — ABO kampaniya va 3 ta auditoriya segmenti bo'yicha aniq tavsiyalar\n"
        "Har bir taklifga qisqa asos yoz."
    )
    content = await ask([{"role": "user", "content": prompt}], max_tokens=3000)

    report = StrategyReport(month=next_month.strftime("%Y-%m"), content=content)
    db.add(report)
    db.commit()
    log.info("Monthly strategy report #%d created for %s", report.id, report.month)
    return report


async def answer_question(db: Session, question: str) -> str:
    """On-demand strategic answer with current business context attached."""
    metrics = collect_metrics(db)
    prompt = f"{metrics}\n\nEGA SAVOLI: {question}\n\nStrategik, amaliy javob ber."
    return await ask([{"role": "user", "content": prompt}], max_tokens=2048)
