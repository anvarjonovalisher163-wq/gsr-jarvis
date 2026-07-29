"""Module B — Competitor Intelligence.

Public-data-only scraping of competitor accounts with conservative rate
limits, plus a weekly Claude analysis delivered in Uzbek.

This module is intentionally isolated: scheduled runs are gated behind
COMPETITOR_SCRAPE_ENABLED in .env, and nothing else in the app depends on it,
so it can be disabled or removed without side effects.
"""
import asyncio
import logging
import re
from datetime import date, datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..claude_client import ask
from ..models import Competitor, CompetitorPost, IntelReport, utcnow

log = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
# Conservative: one page per competitor per run, long pause between accounts.
SCRAPE_DELAY_SECONDS = 8


def _parse_count(text: str) -> int:
    """'12.3K' -> 12300, '1.1M' -> 1100000, '532' -> 532."""
    text = text.strip().upper().replace(",", ".")
    m = re.match(r"([\d.]+)\s*([KM]?)", text)
    if not m:
        return 0
    value = float(m.group(1))
    mult = {"K": 1_000, "M": 1_000_000}.get(m.group(2), 1)
    return int(value * mult)


async def fetch_telegram_posts(client: httpx.AsyncClient, handle: str) -> list[dict]:
    """Public Telegram channel preview at t.me/s/<handle> — no login needed."""
    try:
        r = await client.get(
            f"https://t.me/s/{handle}", headers={"User-Agent": USER_AGENT}, timeout=30
        )
    except httpx.HTTPError as e:
        log.warning("Telegram fetch failed for %s: %s", handle, e)
        return []
    if r.status_code != 200:
        log.warning("Telegram fetch for %s returned %s", handle, r.status_code)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    posts = []
    for msg in soup.select(".tgme_widget_message"):
        external_id = msg.get("data-post", "")
        if not external_id:
            continue
        text_el = msg.select_one(".tgme_widget_message_text")
        views_el = msg.select_one(".tgme_widget_message_views")
        time_el = msg.select_one("time")
        posted_at = None
        if time_el and time_el.get("datetime"):
            try:
                posted_at = datetime.fromisoformat(time_el["datetime"])
            except ValueError:
                pass
        posts.append(
            {
                "external_id": external_id,
                "caption": text_el.get_text("\n", strip=True) if text_el else "",
                "engagement": _parse_count(views_el.get_text(strip=True)) if views_el else 0,
                "posted_at": posted_at,
            }
        )
    return posts


async def fetch_instagram_posts(client: httpx.AsyncClient, handle: str) -> list[dict]:
    """Best-effort public Instagram fetch.

    Instagram aggressively blocks anonymous scraping, so per-post data is
    normally NOT available without the official Graph API or a licensed data
    provider. This function stays as a documented extension point: it makes a
    single polite request and returns [] when nothing usable comes back.
    Plug in the official API here if per-post competitor data is needed.
    """
    try:
        r = await client.get(
            f"https://www.instagram.com/{handle}/",
            headers={"User-Agent": USER_AGENT},
            timeout=30,
            follow_redirects=True,
        )
    except httpx.HTTPError as e:
        log.warning("Instagram fetch failed for %s: %s", handle, e)
        return []
    if r.status_code != 200:
        log.info("Instagram profile %s not accessible anonymously (%s)", handle, r.status_code)
    return []


async def run_scrape(db: Session) -> int:
    """Fetch recent posts for every enabled competitor. Returns new-post count."""
    competitors = db.scalars(select(Competitor).where(Competitor.enabled.is_(True))).all()
    new_count = 0
    async with httpx.AsyncClient() as client:
        for comp in competitors:
            if comp.platform == "telegram":
                items = await fetch_telegram_posts(client, comp.handle)
            else:
                items = await fetch_instagram_posts(client, comp.handle)

            for item in items:
                exists = db.scalar(
                    select(CompetitorPost.id).where(
                        CompetitorPost.competitor_id == comp.id,
                        CompetitorPost.external_id == item["external_id"],
                    )
                )
                if exists:
                    # Refresh the engagement number on the stored row
                    db.query(CompetitorPost).filter(CompetitorPost.id == exists).update(
                        {"engagement": item["engagement"]}
                    )
                    continue
                db.add(CompetitorPost(competitor_id=comp.id, **item))
                new_count += 1
            db.commit()
            await asyncio.sleep(SCRAPE_DELAY_SECONDS)  # rate limit between accounts
    log.info("Competitor scrape finished: %d new posts", new_count)
    return new_count


async def run_weekly_analysis(db: Session) -> IntelReport | None:
    """Ask Claude to analyze the last 7 days of competitor posts (in Uzbek)."""
    since = utcnow() - timedelta(days=7)
    rows = db.execute(
        select(CompetitorPost, Competitor)
        .join(Competitor, Competitor.id == CompetitorPost.competitor_id)
        .where(CompetitorPost.fetched_at >= since)
        .order_by(Competitor.id, CompetitorPost.posted_at.desc())
    ).all()

    if not rows:
        log.info("Weekly analysis skipped: no competitor posts in the last 7 days")
        return None

    lines = []
    for post, comp in rows[:80]:  # cap prompt size / cost
        when = post.posted_at.date().isoformat() if post.posted_at else "?"
        caption = (post.caption or "").replace("\n", " ")[:400]
        lines.append(
            f"- [{comp.name} / {comp.platform}] {when} | ko'rishlar: {post.engagement} | {caption}"
        )

    prompt = (
        "Quyida raqobatchilarimizning so'nggi 7 kundagi postlari keltirilgan "
        "(Xitoy–O'zbekiston logistika bozori).\n\n"
        + "\n".join(lines)
        + "\n\nShu ma'lumot asosida haftalik raqobat tahlili tayyorla. Bo'limlar:\n"
        "1. Aksiyalar va takliflar — kim qanday aksiya yuritayapti\n"
        "2. Kontent formatlari — nima yaxshi ishlayapti (ko'rishlar bo'yicha)\n"
        "3. Narx signallari — e'lon qilingan tariflar/narxlar\n"
        "4. GSR Logistics uchun tavsiyalar — bu hafta nima qilishimiz kerak\n"
        "Qisqa, aniq, amaliy yoz."
    )

    summary = await ask([{"role": "user", "content": prompt}], max_tokens=2048)
    report = IntelReport(
        period_start=(date.today() - timedelta(days=7)),
        period_end=date.today(),
        summary=summary,
    )
    db.add(report)
    db.commit()
    log.info("Weekly intel report #%d created", report.id)
    return report
