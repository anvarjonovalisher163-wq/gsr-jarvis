"""Scheduled jobs (APScheduler, Asia/Tashkent).

Jobs:
  * Monday 08:00       — generate the weekly content plan (Module A)
  * daily 07:30        — competitor scrape (Module B, only if enabled)
  * Sunday 20:00       — weekly competitor analysis (Module B, only if enabled)
  * 1st of month 09:00 — monthly strategy report (Module C)

NOTE (safety rule): there is intentionally NO publishing job here and this
module must never import `modules.publisher`. Publishing happens only through
the owner-authenticated /api/publish endpoint.
"""
import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import get_settings
from .database import SessionLocal
from .modules import (
    competitor_intel,
    content_factory,
    meta_ads,
    page_insights,
    seasons,
    strategy_advisor,
)
from .push import notify_owner

log = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler(timezone=settings.timezone)


async def job_weekly_plan() -> None:
    with SessionLocal() as db:
        posts = await content_factory.generate_weekly_plan(db)
    await notify_owner(
        "Haftalik kontent-plan tayyor",
        f"{len(posts)} ta post yozildi — tasdiqlash uchun Shtab bo'limini oching.",
    )


async def job_scrape() -> None:
    with SessionLocal() as db:
        await competitor_intel.run_scrape(db)


async def job_weekly_intel() -> None:
    with SessionLocal() as db:
        report = await competitor_intel.run_weekly_analysis(db)
    if report:
        await notify_owner(
            "Haftalik raqobat tahlili tayyor",
            "Raqobatchilar bo'yicha yangi hisobot Shtab bo'limida.",
        )


async def job_sync_ads() -> None:
    """Nightly Meta Ads pull. Failure here must not take down other jobs, so
    it is caught and logged rather than raised."""
    try:
        with SessionLocal() as db:
            await asyncio.to_thread(meta_ads.sync, db, 30)
    except Exception as e:  # noqa: BLE001 — module isolation is the point
        log.warning("Meta Ads sync failed (other modules unaffected): %s", e)


async def job_sync_insights() -> None:
    """Nightly Instagram Insights pull; isolated like the ads sync."""
    try:
        with SessionLocal() as db:
            await asyncio.to_thread(page_insights.sync, db, 30)
    except Exception as e:  # noqa: BLE001 — module isolation is the point
        log.warning("Insights sync failed (other modules unaffected): %s", e)


async def job_weekly_reminders() -> None:
    """Monday morning owner briefing: manual Ad Library check + any open
    seasonal campaign windows. Deterministic, no AI."""
    lines = [
        "Raqobatchilarni ko'zdan kechiring: facebook.com/ads/library "
        "(O'zbekiston uchun avtomatik o'qib bo'lmaydi, 5 daqiqalik qo'l tekshiruvi)."
    ]
    for s in seasons.active_signals()[:3]:
        lines.append(f"{s['name']}: {s['days_left']} kun qoldi — {s['cta']}")
    await notify_owner("Haftalik marketing eslatmasi", "\n".join(lines))


async def job_monthly_strategy() -> None:
    with SessionLocal() as db:
        report = await strategy_advisor.run_monthly_strategy(db)
    await notify_owner(
        "Oylik strategiya tayyor",
        f"{report.month} oyi uchun marketing taktikalari Shtab bo'limida.",
    )


def start_scheduler() -> None:
    scheduler.add_job(
        job_weekly_plan,
        CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="weekly_plan",
        replace_existing=True,
    )
    scheduler.add_job(
        job_monthly_strategy,
        CronTrigger(day=1, hour=9, minute=0),
        id="monthly_strategy",
        replace_existing=True,
    )
    scheduler.add_job(
        job_weekly_reminders,
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_reminders",
        replace_existing=True,
    )
    if meta_ads.is_configured():
        scheduler.add_job(
            job_sync_ads,
            CronTrigger(hour=6, minute=0),
            id="sync_ads",
            replace_existing=True,
        )
    if page_insights.is_configured():
        scheduler.add_job(
            job_sync_insights,
            CronTrigger(hour=6, minute=10),
            id="sync_insights",
            replace_existing=True,
        )
    if settings.competitor_scrape_enabled:
        scheduler.add_job(
            job_scrape,
            CronTrigger(hour=7, minute=30),
            id="daily_scrape",
            replace_existing=True,
        )
        scheduler.add_job(
            job_weekly_intel,
            CronTrigger(day_of_week="sun", hour=20, minute=0),
            id="weekly_intel",
            replace_existing=True,
        )
    scheduler.start()
    log.info(
        "Scheduler started (%s), competitor scraping %s",
        settings.timezone,
        "enabled" if settings.competitor_scrape_enabled else "disabled",
    )


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
