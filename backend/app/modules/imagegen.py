"""Pluggable image generation for Instagram posts.

Canva was considered and ruled out: its Connect API (Autofill + Export,
needed to fill a brand template programmatically) requires a **Canva
Enterprise** plan for any private/internal integration — confirmed in
Canva's own developer docs, not just third-party pricing pages. That is a
custom annual contract, disproportionate for this use case, and Canva
doesn't do free-text image generation anyway (it fills a template you
design by hand; it isn't an AI image generator).

The default provider is OpenAI's image API instead: a plain API key, no
OAuth consent flow, no enterprise contract, pay-per-image (roughly
$0.02-$0.19 depending on `IMAGE_QUALITY`).

The Meta Graph API requires a PUBLICLY REACHABLE image URL, so a provider
must both generate the image and host it. The OpenAI provider saves the
result under backend/media and serves it via the app's own /media mount;
PUBLIC_BASE_URL turns that into an absolute URL. Note Instagram's servers
can never reach a local/LAN address, so an end-to-end publish test only
works from the real VPS deployment — local runs can still generate and
preview the image, just not complete a live Instagram publish.
"""
import base64
import logging
import uuid
from io import BytesIO
from pathlib import Path
from typing import Protocol

import httpx
from PIL import Image

from ..config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# Instagram feed sizes (aspect ratio matters more than exact pixel count;
# Instagram accepts a range, but rejects anything taller than 4:5).
SIZE_SQUARE = "1080x1080"
SIZE_PORTRAIT = "1080x1350"

MEDIA_DIR = Path(__file__).resolve().parent.parent.parent / "media" / "generated"

# OpenAI's gpt-image-1 only accepts these exact sizes. Neither is exactly
# 1080x1080/1080x1350, but the square one matches our aspect ratio exactly
# (no cropping needed) and the portrait one is generated taller than needed
# and center-cropped down to Instagram's 4:5 limit in _fit_aspect().
OPENAI_SIZE_FOR = {
    SIZE_SQUARE: "1024x1024",
    SIZE_PORTRAIT: "1024x1536",
}
TARGET_ASPECT = {SIZE_SQUARE: 1.0, SIZE_PORTRAIT: 1080 / 1350}  # width / height


class ImageProvider(Protocol):
    name: str

    async def generate(self, prompt: str, size: str = SIZE_SQUARE) -> str | None:
        """Return a public image URL, or None if generation is unavailable."""
        ...


class StubProvider:
    """Default no-op provider used when no image API is configured."""

    name = "stub"

    async def generate(self, prompt: str, size: str = SIZE_SQUARE) -> str | None:
        log.info("Image generation skipped (stub provider). Prompt was: %s", prompt[:120])
        return None


def _fit_aspect(img: Image.Image, size: str) -> Image.Image:
    """Center-crop to the aspect ratio Instagram expects for `size`.

    OpenAI's closest portrait size (1024x1536, a 2:3 image) is narrower than
    Instagram's 4:5 limit, so it would be rejected untouched — crop the
    excess height off the top and bottom evenly.
    """
    target = TARGET_ASPECT[size]
    w, h = img.size
    current = w / h
    if abs(current - target) < 0.01:
        return img
    if current < target:
        # too tall for the target aspect — crop height
        new_h = int(w / target)
        top = (h - new_h) // 2
        return img.crop((0, top, w, top + new_h))
    # too wide — crop width
    new_w = int(h * target)
    left = (w - new_w) // 2
    return img.crop((left, 0, left + new_w, h))


class OpenAIProvider:
    """Generates via OpenAI's image API and hosts the result locally."""

    name = "openai"

    async def generate(self, prompt: str, size: str = SIZE_SQUARE) -> str | None:
        if not settings.image_provider_api_key:
            log.warning("IMAGE_PROVIDER=openai but IMAGE_PROVIDER_API_KEY is empty")
            return None

        openai_size = OPENAI_SIZE_FOR.get(size, "1024x1024")
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {settings.image_provider_api_key}"},
                    json={
                        "model": "gpt-image-1",
                        "prompt": prompt,
                        "size": openai_size,
                        "quality": settings.image_quality,
                        "n": 1,
                    },
                )
                data = r.json()
        except httpx.HTTPError as e:
            log.error("OpenAI image request failed: %s", e)
            return None

        if "error" in data:
            log.error("OpenAI image API error: %s", data["error"].get("message"))
            return None

        try:
            b64 = data["data"][0]["b64_json"]
        except (KeyError, IndexError):
            log.error("OpenAI image response missing b64_json")
            return None

        img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")
        img = _fit_aspect(img, size)

        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.jpg"
        img.save(MEDIA_DIR / filename, "JPEG", quality=92)

        base = settings.public_base_url.rstrip("/")
        if not base:
            log.warning(
                "PUBLIC_BASE_URL is empty — the returned URL will not be reachable "
                "by Instagram. Set it in .env (e.g. https://jarvis.gsr.uz)."
            )
        return f"{base}/media/generated/{filename}"


_PROVIDERS: dict[str, ImageProvider] = {
    "stub": StubProvider(),
    "openai": OpenAIProvider(),
}


def get_provider() -> ImageProvider:
    provider = _PROVIDERS.get(settings.image_provider)
    if provider is None:
        log.warning("Unknown IMAGE_PROVIDER=%s, falling back to stub", settings.image_provider)
        return _PROVIDERS["stub"]
    return provider
