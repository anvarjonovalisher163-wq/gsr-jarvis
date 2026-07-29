"""Birinchi marta .env yaratish — maxfiy kalitlarni avtomatik generatsiya qiladi.

Mavjud .env ni USTIDAN YOZMAYDI. Agar allaqachon bo'lsa, chiqadi.

Ishlatish (repo ildizidan yoki backend/ ichidan):
    python scripts/bootstrap_env.py
    python scripts/bootstrap_env.py --force   # ehtiyotkorlik bilan qayta yozadi
"""
from __future__ import annotations

import argparse
import secrets
from pathlib import Path

import bcrypt

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = REPO_ROOT / ".env"
EXAMPLE = REPO_ROOT / ".env.example"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Mavjud .env ni zaxira nusxasi bilan almashtirish",
    )
    parser.add_argument(
        "--password",
        default="jarvis-dev-2026",
        help="Dev parol (faqat lokal sinov uchun, default: jarvis-dev-2026)",
    )
    args = parser.parse_args()

    if ENV_FILE.is_file() and not args.force:
        print(f".env allaqachon mavjud: {ENV_FILE}")
        print("Qayta yaratish: python scripts/bootstrap_env.py --force")
        return 0

    if not EXAMPLE.is_file():
        print(f".env.example topilmadi: {EXAMPLE}")
        return 1

    if ENV_FILE.is_file() and args.force:
        backup = ENV_FILE.with_suffix(".env.bak")
        backup.write_text(ENV_FILE.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Eski .env zaxiralandi: {backup}")

    jwt = secrets.token_hex(32)
    crm = secrets.token_hex(32)
    pw_hash = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode()

    text = EXAMPLE.read_text(encoding="utf-8")
    replacements = {
        "OWNER_PASSWORD_HASH=": f"OWNER_PASSWORD_HASH={pw_hash}",
        "JWT_SECRET=": f"JWT_SECRET={jwt}",
        "CRM_WEBHOOK_SECRET=": f"CRM_WEBHOOK_SECRET={crm}",
    }

    lines = []
    for line in text.splitlines():
        replaced = False
        for prefix, new_line in replacements.items():
            if line.startswith(prefix) and not line.startswith("#"):
                lines.append(new_line)
                replaced = True
                break
        if not replaced:
            lines.append(line)

    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f".env yaratildi: {ENV_FILE}\n")
    print("Avtomatik to'ldirildi:")
    print(f"  OWNER_PASSWORD_HASH  (parol: {args.password})")
    print(f"  JWT_SECRET           ({len(jwt)} belgi)")
    print(f"  CRM_WEBHOOK_SECRET   ({len(crm)} belgi)")
    print()
    print("Qo'lda to'ldiring:")
    print("  ANTHROPIC_API_KEY    — https://platform.claude.com/")
    print("  META_ACCESS_TOKEN    — python scripts/check_meta_token.py")
    print()
    print("Keyingi qadam:")
    print("  cd backend && source venv/bin/activate && python scripts/setup_check.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
