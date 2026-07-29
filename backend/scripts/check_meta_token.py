"""Meta token tekshiruvchi va .env ga yozuvchi.

Tokeningizni tekshiradi, ruxsatlarni ko'rsatadi va ID'larni topadi.

Eng oson yo'l:
    1. Tokenni .env ga yozing:  META_ACCESS_TOKEN=EAAG...
    2. Tekshirish:             python scripts/check_meta_token.py
    3. .env ga saqlash:        python scripts/check_meta_token.py --apply

Yoki bir qadamda: python scripts/setup_meta.py

Token faqat graph.facebook.com ga yuboriladi.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

# Some terminals (Windows legacy codepages, certain shell wrappers) cannot
# encode the em-dashes and bullets used throughout this script's output —
# on cp1251 that crashes outright; elsewhere it silently mangles the text
# into replacement characters. UTF-8 with errors="replace" is safe on every
# platform and guarantees readable (or at worst harmlessly degraded) output.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

import httpx

from meta_env import clean_token, diagnose_env, is_placeholder, read_meta_from_env, write_meta_to_env

GRAPH = "https://graph.facebook.com/v21.0"

NEEDED = {
    "ads_read": "Reklama xarajati va ROI tahlili",
    "instagram_basic": "Instagram sahifa ma'lumoti",
    "instagram_manage_insights": "Sahifa statistikasi (qamrov, profil ko'rish)",
    "pages_show_list": "Instagram business ID'ni topish",
    "instagram_content_publish": "Postni Instagramga joylash",
}

OK = "  [OK]  "
NO = "  [YO'Q]"
WARN = "  [!]   "


def get(client: httpx.Client, path: str, token: str, **params) -> dict:
    try:
        r = client.get(f"{GRAPH}/{path}", params={**params, "access_token": token}, timeout=30)
        return r.json()
    except (httpx.HTTPError, ValueError) as e:
        return {"error": {"message": f"so'rov bajarilmadi: {e}"}}


def read_token(interactive: bool = True) -> str:
    token = clean_token(os.environ.get("META_ACCESS_TOKEN") or "")
    if token and not is_placeholder(token):
        print("Token muhit o'zgaruvchisidan olindi.")
        return token

    env_token = read_meta_from_env().get("META_ACCESS_TOKEN", "")
    if env_token and not is_placeholder(env_token):
        print("Token .env faylidan olindi.")
        return env_token

    if not interactive:
        return ""

    print("Token .env faylida topilmadi.")
    print("Uni .env ga yozing:  META_ACCESS_TOKEN=EAAG...\n")
    try:
        token = clean_token(getpass.getpass("Token (ko'rinmaydi): "))
    except Exception:
        token = ""
    if not token:
        print("(yashirin kiritish ishlamadi — ochiq holda so'raladi)")
        try:
            token = clean_token(input("Token: "))
        except EOFError:
            return ""
    return token


def validate_token(token: str) -> dict:
    """Tokenni tekshiradi. Natija: ok, ad_account_id, ig_id, errors."""
    result = {
        "ok": False,
        "token": token,
        "name": "",
        "ad_account_id": None,
        "ig_id": None,
        "errors": [],
        "warnings": [],
    }

    if len(token) < 50:
        result["warnings"].append("Token juda qisqa — to'liq nusxalanmagan bo'lishi mumkin.")
    if not token.startswith("EAA"):
        result["warnings"].append("Token 'EAA' bilan boshlanmadi.")

    with httpx.Client() as client:
        me = get(client, "me", token, fields="id,name")
        if "error" in me:
            result["errors"].append(me["error"].get("message", "Token ishlamadi"))
            return result

        result["name"] = me.get("name", "?")
        result["ok"] = True

        accounts = get(
            client, "me/adaccounts", token, fields="id,account_id,name,currency,account_status"
        )
        if "error" in accounts:
            result["errors"].append(f"Reklama akkauntlari: {accounts['error'].get('message')}")
        elif accounts.get("data"):
            for a in accounts["data"]:
                if a.get("account_status") == 1 and result["ad_account_id"] is None:
                    result["ad_account_id"] = a.get("account_id")
            if result["ad_account_id"] is None:
                result["ad_account_id"] = accounts["data"][0].get("account_id")
        else:
            result["errors"].append("Reklama akkaunti topilmadi — ads_read yoki asset biriktirishni tekshiring.")

        pages = get(
            client, "me/accounts", token, fields="name,instagram_business_account{id,username}"
        )
        if "error" in pages:
            result["errors"].append(f"Instagram: {pages['error'].get('message')}")
        else:
            for p in pages.get("data") or []:
                iba = p.get("instagram_business_account")
                if iba and result["ig_id"] is None:
                    result["ig_id"] = iba.get("id")
            if result["ig_id"] is None:
                result["errors"].append("Instagram business ID topilmadi — sahifaga bog'langan bo'lsin.")

        if result["ad_account_id"]:
            ins = get(
                client,
                f"act_{result['ad_account_id']}/insights",
                token,
                fields="spend",
                date_preset="last_7d",
            )
            if "error" in ins:
                result["errors"].append(f"Xarajat o'qilmadi: {ins['error'].get('message')}")

        if result["ig_id"]:
            ins = get(client, f"{result['ig_id']}/insights", token, metric="reach", period="day")
            if "error" in ins:
                result["errors"].append(f"Insights o'qilmadi: {ins['error'].get('message')}")

    return result


def print_report(token: str, result: dict) -> None:
    print(f"\nQabul qilindi: {len(token)} belgi, boshlanishi '{token[:4]}...'")
    for w in result["warnings"]:
        print(f"{WARN} {w}")

    if not result["ok"]:
        for e in result["errors"]:
            print(f"{NO} {e}")
        return

    print(f"\n{OK} Token amal qilyapti — {result['name']}")

    print("\nRUXSATLAR (kerakli):")
    for scope, why in NEEDED.items():
        print(f"  • {scope:<28} — {why}")

    print("\nREKLAMA AKKAUNTI:")
    if result["ad_account_id"]:
        print(f"{OK} META_AD_ACCOUNT_ID={result['ad_account_id']}")
    else:
        print(f"{NO} topilmadi")

    print("\nINSTAGRAM:")
    if result["ig_id"]:
        print(f"{OK} IG_BUSINESS_ID={result['ig_id']}")
    else:
        print(f"{NO} topilmadi")

    if result["errors"]:
        print("\nMUAMMOLAR:")
        for e in result["errors"]:
            print(f"{NO} {e}")


def apply_to_env(token: str, result: dict) -> None:
    if not result["ad_account_id"] and not result["ig_id"]:
        print("\n.env ga yozish bekor — hech qanday ID topilmadi.")
        sys.exit(1)

    values = {"META_ACCESS_TOKEN": token}
    if result["ad_account_id"]:
        values["META_AD_ACCOUNT_ID"] = str(result["ad_account_id"])
    if result["ig_id"]:
        values["IG_BUSINESS_ID"] = str(result["ig_id"])

    path = write_meta_to_env(values)
    print(f"\n{OK} .env yangilandi: {path}")
    for key, val in values.items():
        if key == "META_ACCESS_TOKEN":
            print(f"  {key}=EAAG... ({len(val)} belgi)")
        else:
            print(f"  {key}={val}")
    print("\nKeyingi qadam:")
    print("  sudo systemctl restart gsr-jarvis   # VPS'da")
    print("  yoki lokal: uvicorn qayta ishga tushiring")
    print("  sinov: curl -X POST http://127.0.0.1:8000/api/analytics/sync-ads")


def main() -> None:
    parser = argparse.ArgumentParser(description="Meta token tekshiruvi")
    parser.add_argument(
        "--apply",
        action="store_true",
        help=".env fayliga META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, IG_BUSINESS_ID yozish",
    )
    parser.add_argument(
        "--no-input",
        action="store_true",
        help="Interaktiv so'rov yo'q — faqat .env yoki META_ACCESS_TOKEN muhit o'zgaruvchisi",
    )
    args = parser.parse_args()

    print("=" * 62)
    print("META TOKEN TEKSHIRUVI")
    print("=" * 62 + "\n")

    token = read_token(interactive=not args.no_input)
    if not token:
        print("\nToken topilmadi.\n")
        for hint in diagnose_env():
            print(f"  • {hint}")
        print("\nTekshiring:")
        print("  • Fayl repo ildizida bo'lsin:  gsr-jarvis/.env")
        print("  • Qator shakli:               META_ACCESS_TOKEN=EAAG...")
        print("  • Bo'shliqsiz:                META_ACCESS_TOKEN=EAAG ( = atrofida probel yo'q)")
        print("  • Token faqat bir marta ko'rinadi — to'liq nusxalanganini tekshiring")
        print("\nToken qo'yganingizdan keyin:")
        print("  python scripts/check_meta_token.py --apply")
        sys.exit(1)

    result = validate_token(token)
    print_report(token, result)

    print("\n" + "=" * 62)
    if args.apply:
        if not result["ok"]:
            sys.exit(1)
        apply_to_env(token, result)
    elif result["ad_account_id"] or result["ig_id"]:
        print("Saqlash: python scripts/check_meta_token.py --apply")
    else:
        print("Kerakli ID'lar topilmadi — yuqoridagi xatolarni tuzating.")
    print("=" * 62 + "\n")

    if not result["ok"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
