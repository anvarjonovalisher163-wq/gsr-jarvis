"""GSR Jarvis — ketma-ket o'rnatish tekshiruvi.

Har bir qadam oldingisi tayyor bo'lgach keyingisiga o'tadi.
Faqat o'qiydi — hech narsani o'zgartirmaydi.

Ishlatish (backend/ ichida, venv aktiv):
    python scripts/setup_check.py
    python scripts/setup_check.py --step 3   # faqat 3-qadam
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import secrets
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
ENV_FILE = REPO_ROOT / ".env"


def _load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not ENV_FILE.is_file():
        return out
    for line in ENV_FILE.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def _ok(msg: str) -> None:
    print(f"  ✓ {msg}")


def _warn(msg: str) -> None:
    print(f"  ⚠ {msg}")


def _fail(msg: str) -> None:
    print(f"  ✗ {msg}")


def _placeholder(value: str) -> bool:
    if not value:
        return True
    upper = value.upper()
    return any(x in upper for x in ("...", "CHANGE-ME", "REPLACE", "EXAMPLE", "YOUR_"))


STEPS = [
    {
        "num": 1,
        "title": "Python muhiti va kutubxonalar",
        "hint": "cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt",
    },
    {
        "num": 2,
        "title": ".env fayli va majburiy kalitlar",
        "hint": "python scripts/bootstrap_env.py  — namuna .env yaratadi",
    },
    {
        "num": 3,
        "title": "Backend va ma'lumotlar bazasi",
        "hint": "uvicorn app.main:app --host 127.0.0.1 --port 8000  →  curl http://127.0.0.1:8000/api/health",
    },
    {
        "num": 4,
        "title": "Avtomatik testlar",
        "hint": "python -m pytest tests -q",
    },
    {
        "num": 5,
        "title": "Meta token (reklama + Instagram)",
        "hint": "python scripts/setup_meta.py  →  python scripts/check_meta_token.py --apply",
    },
    {
        "num": 6,
        "title": "Frontend build",
        "hint": "cd frontend && npm install && npm run build",
    },
    {
        "num": 7,
        "title": "VPS: systemd + nginx + SSL",
        "hint": "README.md → VPS'ga o'rnatish (8-9 bo'limlar)",
        "optional": True,
    },
    {
        "num": 8,
        "title": "CRM webhook (oxirida)",
        "hint": ".env da CRM_WEBHOOK_SECRET — sherik webhook yuboradi",
        "optional": True,
    },
]


def check_step_1() -> bool:
    ok = True
    if sys.version_info < (3, 11):
        _fail(f"Python 3.11+ kerak (hozir {sys.version_info.major}.{sys.version_info.minor})")
        ok = False
    else:
        _ok(f"Python {sys.version_info.major}.{sys.version_info.minor}")

    venv_py = BACKEND_DIR / "venv" / "bin" / "python"
    if venv_py.is_file():
        _ok("venv mavjud (backend/venv)")
    else:
        _warn("venv topilmadi — backend/venv yarating")
        ok = False

    for pkg in ("fastapi", "sqlalchemy", "httpx", "apscheduler"):
        if importlib.util.find_spec(pkg):
            _ok(f"kutubxona: {pkg}")
        else:
            _fail(f"kutubxona yo'q: {pkg} — pip install -r requirements.txt")
            ok = False
    return ok


def check_step_2() -> bool:
    ok = True
    if not ENV_FILE.is_file():
        _fail(f".env topilmadi: {ENV_FILE}")
        _warn("Yaratish: python scripts/bootstrap_env.py")
        return False
    _ok(f".env mavjud ({ENV_FILE})")

    env = _load_env()
    required = {
        "OWNER_PASSWORD_HASH": "Kirish paroli (bcrypt hash)",
        "JWT_SECRET": "JWT imzo kaliti (kamida 32 bayt)",
    }
    for key, label in required.items():
        val = env.get(key, "")
        if _placeholder(val):
            _fail(f"{key} to'ldirilmagan — {label}")
            ok = False
        else:
            _ok(f"{key} bor")

    anthropic = env.get("ANTHROPIC_API_KEY", "")
    if _placeholder(anthropic):
        _warn("ANTHROPIC_API_KEY yo'q — chat va kontent-plan ishlamaydi (keyinroq qo'shing)")
    else:
        _ok("ANTHROPIC_API_KEY bor")

    if len(env.get("JWT_SECRET", "")) < 32:
        _warn("JWT_SECRET qisqa — python -c \"import secrets; print(secrets.token_hex(32))\"")
        ok = False
    return ok


def check_step_3() -> bool:
    ok = True
    try:
        os.chdir(BACKEND_DIR)
        sys.path.insert(0, str(BACKEND_DIR))
        from app.database import engine
        from app.models import Lead  # noqa: F401 — jadval ro'yxatdan o'tishi uchun
        from sqlalchemy import inspect

        from app.database import Base

        Base.metadata.create_all(engine)
        tables = inspect(engine).get_table_names()
        if "leads" in tables:
            _ok(f"SQLite bazasi tayyor ({len(tables)} jadval)")
        else:
            _fail("leads jadvali yaratilmadi")
            ok = False
    except Exception as e:
        _fail(f"Baza xatosi: {e}")
        ok = False
    return ok


def check_step_4() -> bool:
    import subprocess

    venv_py = BACKEND_DIR / "venv" / "bin" / "python"
    py = str(venv_py) if venv_py.is_file() else sys.executable
    result = subprocess.run(
        [py, "-m", "pytest", "tests", "-q", "--tb=no"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        line = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "OK"
        _ok(f"testlar o'tdi ({line})")
        return True
    _fail("testlar yiqildi — python -m pytest tests -q")
    if result.stdout:
        print(result.stdout[-500:])
    return False


def check_step_5() -> bool:
    env = _load_env()
    token = env.get("META_ACCESS_TOKEN", "")
    ad_id = env.get("META_AD_ACCOUNT_ID", "")
    ig_id = env.get("IG_BUSINESS_ID", "")

    if _placeholder(token):
        _fail("META_ACCESS_TOKEN yo'q")
        _warn("Yo'riqnoma: python scripts/setup_meta.py")
        _warn("Token olgach: python scripts/check_meta_token.py --apply")
        return False

    _ok("META_ACCESS_TOKEN bor")
    ok = True
    if _placeholder(ad_id):
        _warn("META_AD_ACCOUNT_ID yo'q — ROI hisoblanmaydi")
        ok = False
    else:
        _ok("META_AD_ACCOUNT_ID bor")
    if _placeholder(ig_id):
        _warn("IG_BUSINESS_ID yo'q — Instagram statistikasi ishlamaydi")
        ok = False
    else:
        _ok("IG_BUSINESS_ID bor")
    return ok


def check_step_6() -> bool:
    dist = REPO_ROOT / "frontend" / "dist" / "index.html"
    node_modules = REPO_ROOT / "frontend" / "node_modules"
    if dist.is_file():
        _ok("frontend/dist build mavjud")
        return True
    if node_modules.is_dir():
        _warn("node_modules bor, lekin build yo'q — npm run build")
    else:
        _warn("frontend o'rnatilmagan — cd frontend && npm install && npm run build")
    return False


def check_step_7() -> bool:
    _warn("VPS tekshiruvi bu muhitdan avtomatik bajarilmaydi")
    _warn("Qo'lda: systemctl status gsr-jarvis, nginx -t, certbot")
    return False


def check_step_8() -> bool:
    env = _load_env()
    secret = env.get("CRM_WEBHOOK_SECRET", "")
    if _placeholder(secret):
        _warn("CRM hali ulanmagan — oxirgi qadam (hozircha ixtiyoriy)")
        return False
    _ok("CRM_WEBHOOK_SECRET sozlangan — sherik webhook yuborishi mumkin")
    return True


CHECKERS = {
    1: check_step_1,
    2: check_step_2,
    3: check_step_3,
    4: check_step_4,
    5: check_step_5,
    6: check_step_6,
    7: check_step_7,
    8: check_step_8,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="GSR Jarvis ketma-ket o'rnatish tekshiruvi")
    parser.add_argument("--step", type=int, help="Faqat bitta qadam (1-8)")
    args = parser.parse_args()

    print("GSR Jarvis — o'rnatish ketma-ketligi\n")

    steps = STEPS if args.step is None else [s for s in STEPS if s["num"] == args.step]
    if args.step and not steps:
        print(f"Noto'g'ri qadam: {args.step} (1-8)")
        return 1

    passed = 0
    blocked = False
    for step in steps:
        n = step["num"]
        print(f"[{n}/8] {step['title']}")
        if blocked:
            _warn(f"O'tkazib yuborildi — oldingi qadam bajarilmagan")
            print(f"      Yordam: {step['hint']}\n")
            continue

        checker = CHECKERS[n]
        if checker():
            passed += 1
        else:
            if not step.get("optional"):
                blocked = True
            print(f"      Yordam: {step['hint']}")
        print()

    total = len(steps)
    print(f"Natija: {passed}/{total} qadam tayyor")
    if blocked:
        print("\nKeyingi qadamni bajarish uchun yuqoridagi ⚠/✗ ni tuzating.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
