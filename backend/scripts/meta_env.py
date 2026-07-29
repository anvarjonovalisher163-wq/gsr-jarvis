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
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key in out:
            out[key] = value.strip().strip('"').strip("'")
    return out


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
