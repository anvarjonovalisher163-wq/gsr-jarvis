"""Module D — Instagram publishing via the Meta Graph API.

=====================================================================
SAFETY: NOTHING IS EVER AUTO-PUBLISHED — ARCHITECTURAL GUARANTEE
=====================================================================
1. This module is imported ONLY by `app/routers/publish.py`, which sits
   behind owner JWT auth. The scheduler (`app/scheduler.py`) has no import
   path to this module, so no background job can ever publish anything.
2. `publish_post()` itself refuses any post that has not been explicitly
   approved by the owner (status == APPROVED and approved_at is set).
Keep both properties intact when extending the code.
=====================================================================

Note: the Instagram Content Publishing API only accepts posts with media —
a publicly reachable image URL is required (1080x1080 for single posts,
1080x1350 works for carousels). Text-only posts are rejected by Instagram
itself, not by this app.
"""
import asyncio
import json
import logging

import httpx

from ..config import get_settings
from ..models import ContentPost, PostStatus

log = logging.getLogger(__name__)
settings = get_settings()

GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_version}"


class PublishError(Exception):
    """Raised with an owner-readable (Uzbek) message."""


def _require_configured() -> None:
    if not settings.meta_access_token or not settings.ig_business_id:
        raise PublishError(
            "Meta Graph API sozlanmagan: .env faylida META_ACCESS_TOKEN va "
            "IG_BUSINESS_ID qiymatlarini to'ldiring."
        )


async def _graph_post(client: httpx.AsyncClient, path: str, params: dict) -> dict:
    r = await client.post(
        f"{GRAPH_BASE}/{path}",
        params={**params, "access_token": settings.meta_access_token},
    )
    try:
        data = r.json()
    except ValueError:
        raise PublishError(f"Meta API kutilmagan javob qaytardi (HTTP {r.status_code})")
    if r.status_code >= 400 or "error" in data:
        msg = data.get("error", {}).get("message", r.text[:300])
        raise PublishError(f"Meta API xatosi: {msg}")
    return data


async def publish_post(post: ContentPost) -> str:
    """Publish an APPROVED post to Instagram. Returns the IG media id."""
    # === SAFETY GUARD: owner approval is mandatory, no exceptions. ===
    if post.status != PostStatus.APPROVED or post.approved_at is None:
        raise PublishError("Bu post egasi tomonidan tasdiqlanmagan — joylab bo'lmaydi.")

    _require_configured()

    try:
        images: list[str] = json.loads(post.image_urls or "[]")
    except ValueError:
        images = []
    if not images:
        raise PublishError(
            "Instagram rasmsiz postni qabul qilmaydi — avval postga ochiq (public) "
            "rasm URL biriktiring."
        )

    caption = post.body.strip()
    if post.hashtags.strip():
        caption += "\n\n" + post.hashtags.strip()

    async with httpx.AsyncClient(timeout=60) as client:
        if len(images) == 1:
            container = await _graph_post(
                client,
                f"{settings.ig_business_id}/media",
                {"image_url": images[0], "caption": caption},
            )
        else:
            # Carousel: create child containers first, then the parent.
            children = []
            for url in images[:10]:  # Instagram carousel limit
                child = await _graph_post(
                    client,
                    f"{settings.ig_business_id}/media",
                    {"image_url": url, "is_carousel_item": "true"},
                )
                children.append(child["id"])
            container = await _graph_post(
                client,
                f"{settings.ig_business_id}/media",
                {"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption},
            )

        creation_id = container["id"]

        # Containers are usually ready instantly for images, but the publish
        # call can race container processing — retry a few times.
        last_err: PublishError | None = None
        for attempt in range(5):
            try:
                published = await _graph_post(
                    client,
                    f"{settings.ig_business_id}/media_publish",
                    {"creation_id": creation_id},
                )
                log.info("Post #%d published to Instagram as %s", post.id, published["id"])
                return published["id"]
            except PublishError as e:
                last_err = e
                await asyncio.sleep(3)
        raise last_err or PublishError("Joylash amalga oshmadi — keyinroq urinib ko'ring.")
