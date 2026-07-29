"""Web Push (VAPID) notifications to the owner's PWA."""
import asyncio
import json
import logging

from pywebpush import WebPushException, webpush

from .config import get_settings
from .database import SessionLocal
from .models import PushSubscription

log = logging.getLogger(__name__)
settings = get_settings()


def notify_owner_sync(title: str, body: str) -> None:
    """Send a push notification to every stored subscription (blocking)."""
    if not settings.vapid_private_key:
        log.info("Push skipped (VAPID keys not configured): %s", title)
        return

    payload = json.dumps({"title": title, "body": body})
    with SessionLocal() as db:
        subs = db.query(PushSubscription).all()
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject},
                )
            except WebPushException as e:
                status = getattr(e.response, "status_code", None)
                if status in (404, 410):
                    # Subscription expired — clean it up
                    db.delete(sub)
                    db.commit()
                else:
                    log.warning("Push delivery failed: %s", e)


async def notify_owner(title: str, body: str) -> None:
    """Async wrapper so scheduler jobs don't block the event loop."""
    await asyncio.to_thread(notify_owner_sync, title, body)
