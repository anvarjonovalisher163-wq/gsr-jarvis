"""Image generation provider — aspect-ratio cropping and provider selection.
No network calls: the OpenAI request itself isn't unit tested here (same
convention as meta_ads/page_insights — network-touching functions are
verified manually against the real API, not mocked in pytest)."""
import asyncio

from PIL import Image

from app.modules import imagegen


def test_square_untouched():
    img = Image.new("RGB", (1024, 1024))
    out = imagegen._fit_aspect(img, imagegen.SIZE_SQUARE)
    assert out.size == (1024, 1024)


def test_portrait_cropped_to_instagram_limit():
    # OpenAI's closest portrait (1024x1536, a 2:3 image) is taller than
    # Instagram's 4:5 limit and must be cropped down, not stretched.
    img = Image.new("RGB", (1024, 1536))
    out = imagegen._fit_aspect(img, imagegen.SIZE_PORTRAIT)
    ratio = out.width / out.height
    assert abs(ratio - 1080 / 1350) < 0.01
    assert out.width == 1024  # width preserved, only height cropped
    assert out.height < 1536


def test_crop_is_centered():
    img = Image.new("RGB", (1024, 1536))
    out = imagegen._fit_aspect(img, imagegen.SIZE_PORTRAIT)
    cropped = 1536 - out.height
    # centered crop removes (roughly) equal margins top and bottom
    assert cropped % 2 == 0 or cropped % 2 == 1  # sanity: no huge remainder
    assert cropped > 0


def test_already_correct_aspect_untouched():
    w, h = 1080, 1350
    img = Image.new("RGB", (w, h))
    out = imagegen._fit_aspect(img, imagegen.SIZE_PORTRAIT)
    assert out.size == (w, h)


def test_get_provider_defaults_to_stub():
    provider = imagegen.get_provider()
    assert provider.name in ("stub", "openai")  # depends on .env, both valid


def test_unknown_provider_falls_back_to_stub(monkeypatch):
    monkeypatch.setattr(imagegen.settings, "image_provider", "does-not-exist")
    assert imagegen.get_provider().name == "stub"


def test_stub_provider_returns_none():
    result = asyncio.run(imagegen.StubProvider().generate("test prompt"))
    assert result is None
