"""Meta token .env yordamchilari — o'qish va xavfsiz yozish."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_CANDIDATES = (REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env")

META_KEYS = ("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "IG_BUSINESS_ID")


def env_path() -> Path | None:
    for candidate in ENV_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def clean_token(raw: str) -> str:
    token = raw.strip().strip('"').strip("'").strip()
    if token.upper().startswith("META_ACCESS_TOKEN="):
        token = token.split("=", 1)[1].strip().strip('"').strip("'")
    return "".join(token.split())


def is_placeholder(value: str) -> bool:
    if not value:
        return True
    upper = value.upper()
    if any(x in upper for x in ("...", "REPLACE", "EXAMPLE", "YOUR_")):
        return True
    if value.startswith("sk-ant"):
        return True
    return False


def read_meta_from_env() -> dict[str, str]:
    path = env_path()
    out = {k: "" for k in META_KEYS}
    if not path:
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        # export META_ACCESS_TOKEN=... (bash uslubi)
        if raw.lower().startswith("export "):
            raw = raw[7:].strip()
        if "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        key = key.strip()
        if key in out:
            out[key] = value.strip().strip('"').strip("'")
    return out


def diagnose_env() -> list[str]:
    """Token topilmasa sababni tushuntiradi (qiymatni ko'rsatmaydi)."""
    hints: list[str] = []
    path = env_path()
    if not path:
        hints.append(".env fayli topilmadi — repo ildizida yoki backend/.env yarating.")
        return hints

    hints.append(f"O'qilayotgan fayl: {path}")
    text = path.read_text(encoding="utf-8", errors="replace")
    if text.startswith("\ufeff"):
        hints.append("Fayl BOM bilan boshlanadi — saqlashda UTF-8 (BOMsiz) tanlang.")

    found_key = False
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.lower().startswith("export "):
            stripped = stripped[7:].strip()
        if not stripped.startswith("META_ACCESS_TOKEN"):
            continue
        found_key = True
        if stripped.startswith("#"):
            hints.append(f"Qator {i}: META_ACCESS_TOKEN IZOH sifatida (#) — # ni olib tashlang.")
            continue
        if "=" not in stripped:
            hints.append(f"Qator {i}: '=' belgisi yo'q — META_ACCESS_TOKEN=EAAG... ko'rinishida yozing.")
            continue
        _, _, val = stripped.partition("=")
        val = clean_token(val)
        if not val:
            hints.append(
                f"Qator {i}: META_ACCESS_TOKEN= bor, lekin QIYMAT BO'SH — "
                "tenglik belgisidan keyin tokenni qo'ying."
            )
        elif is_placeholder(val):
            hints.append(f"Qator {i}: qiymat namuna/placeholder — haqiqiy tokenni qo'ying.")
        else:
            hints.append(f"Qator {i}: token bor ({len(val)} belgi) — skript o'qishi kerak.")
        break

    if not found_key:
        hints.append("META_ACCESS_TOKEN qatori yo'q — .env ga qo'shing: META_ACCESS_TOKEN=EAAG...")
    return hints


def write_meta_to_env(values: dict[str, str]) -> Path:
    """META_* qatorlarini .env ga yozadi. Mavjud faylni yangilaydi yoki yaratadi."""
    path = env_path() or REPO_ROOT / ".env"
    lines: list[str] = []
    if path.is_file():
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()

    updated = set()
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in values:
                new_lines.append(f"{key}={values[key]}")
                updated.add(key)
                continue
        new_lines.append(line)

    for key in META_KEYS:
        if key in values and key not in updated:
            new_lines.append(f"{key}={values[key]}")

    path.write_text("\n".join(new_lines).rstrip() + "\n", encoding="utf-8")
    return path
