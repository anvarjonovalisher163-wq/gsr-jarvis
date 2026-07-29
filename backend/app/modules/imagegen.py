"""Pluggable image generation for Instagram posts.

The Meta Graph API requires a PUBLICLY REACHABLE image URL, so a real
provider must both generate the image and host it (e.g. upload to S3/R2 or
serve from this VPS behind nginx). The stub provider returns None so the
rest of the app works without any image API key.

To add a provider:
  1. Implement `generate()` returning a public URL (or None on failure).
  2. Register it in `_PROVIDERS`.
  3. Set IMAGE_PROVIDER=<name> and IMAGE_PROVIDER_API_KEY in .env.
"""
import logging
from typing import Protocol

from ..config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# Instagram feed sizes
SIZE_SQUARE = "1080x1080"
SIZE_PORTRAIT = "1080x1350"


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


# Example skeleton for a real provider:
#
# class ReplicateProvider:
#     name = "replicate"
#
#     async def generate(self, prompt: str, size: str = SIZE_SQUARE) -> str | None:
#         # 1. call the API with settings.image_provider_api_key
#         # 2. download the result, upload it to public storage
#         # 3. return the public URL
#         ...

_PROVIDERS: dict[str, ImageProvider] = {
    "stub": StubProvider(),
}


def get_provider() -> ImageProvider:
    provider = _PROVIDERS.get(settings.image_provider)
    if provider is None:
        log.warning("Unknown IMAGE_PROVIDER=%s, falling back to stub", settings.image_provider)
        return _PROVIDERS["stub"]
    return provider
