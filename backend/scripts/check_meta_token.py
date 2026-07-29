"""Meta token tekshiruvchi.

Tokeningizni tekshiradi, ruxsatlarni ko'rsatadi va .env uchun kerakli
ID'larni (ad account, Instagram business) o'zi topib beradi.

Eng oson yo'l — tokenni .env fayliga yozib qo'ying:

    META_ACCESS_TOKEN=EAAG...

so'ng backend/ ichida:

    python scripts/check_meta_token.py

Skript tokenni .env dan o'zi topadi. Agar u yerda bo'lmasa, so'raydi.

Skript hech narsani o'zgartirmaydi — faqat o'qiydi va hisobot beradi.
Token faqat graph.facebook.com ga yuboriladi, boshqa hech qayerga.
"""
import getpass
import os
import sys
from pathlib import Path

import httpx

GRAPH = "https://graph.facebook.com/v21.0"
REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def clean(raw: str) -> str:
    """Terminal va nusxalash artefaktlarini olib tashlaydi."""
    token = raw.strip().strip('"').strip("'").strip()
    # Sometimes the whole KEY=value line gets pasted
    if token.upper().startswith("META_ACCESS_TOKEN="):
        token = token.split("=", 1)[1].strip().strip('"').strip("'")
    return "".join(token.split())  # drop stray spaces / newlines


def token_from_env_file() -> str:
    """.env faylidan META_ACCESS_TOKEN ni o'qiydi (repo ildizi yoki backend/)."""
    for candidate in (REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line.startswith("META_ACCESS_TOKEN=") and not line.startswith("#"):
                value = clean(line.split("=", 1)[1])
                if value and "REPLACE" not in value.upper():
                    print(f"Token {candidate} faylidan olindi.")
                    return value
    return ""


def read_token() -> str:
    token = clean(os.environ.get("META_ACCESS_TOKEN") or "")
    if token:
        print("Token muhit o'zgaruvchisidan olindi.")
        return token

    token = token_from_env_file()
    if token:
        return token

    print("Token .env faylida topilmadi.")
    print("Uni shu yerga qo'ying yoki .env fayliga yozing:  META_ACCESS_TOKEN=EAAG...\n")
    try:
        token = clean(getpass.getpass("Token (ko'rinmaydi): "))
    except Exception:
        token = ""
    if not token:
        # Some Windows terminals refuse paste into a hidden prompt
        print("(yashirin kiritish ishlamadi — ochiq holda so'raladi)")
        token = clean(input("Token: "))
    return token

# What each module needs
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


def main() -> None:
    print("=" * 62)
    print("META TOKEN TEKSHIRUVI")
    print("=" * 62 + "\n")

    token = read_token()
    if not token:
        sys.exit("Token berilmadi.")

    # Diagnostics that do not reveal the token itself — enough to spot a
    # truncated or mis-pasted value before blaming Meta.
    print(f"\nQabul qilindi: {len(token)} belgi, boshlanishi '{token[:4]}...'")
    if len(token) < 50:
        print(f"{WARN} Token juda qisqa. To'liq nusxalanmagan bo'lishi mumkin —")
        print("        Meta System User tokeni odatda 180-250 belgi bo'ladi.")
    if not token.startswith("EAA"):
        print(f"{WARN} Token 'EAA' bilan boshlanmadi. Meta tokenlari shunday boshlanadi —")
        print("        boshqa qiymat nusxalangan bo'lishi mumkin.")

    with httpx.Client() as client:
        # --- 1. Token umuman ishlaydimi ---
        me = get(client, "me", token, fields="id,name")
        if "error" in me:
            msg = me["error"].get("message", "")
            print(f"\n{NO} Token ishlamadi: {msg}")
            if "parse" in msg.lower():
                print("\n'Cannot parse' — token buzuq yoki to'liq emas. Odatda sabab:")
                print("  * terminalga to'liq qo'yilmagan (PowerShell'da yashirin")
                print("    kiritishga Ctrl+V har doim ham o'tmaydi)")
                print("  * nusxalashda bir qismi tushib qolgan")
                print("\nYECHIM: tokenni .env fayliga yozing va skriptni qayta")
                print("ishga tushiring — u o'zi o'qib oladi:")
                print("  META_ACCESS_TOKEN=EAAG...")
            else:
                print("\nSabablari odatda: token muddati tugagan yoki ilova o'chirilgan.")
            sys.exit(1)
        print(f"\n{OK} Token amal qilyapti — {me.get('name', '?')} (id {me.get('id')})")

        # --- 2. Ruxsatlar ---
        print("\nRUXSATLAR:")
        granted: set[str] = set()
        perms = get(client, "me/permissions", token)
        if "data" in perms:
            granted = {p["permission"] for p in perms["data"] if p.get("status") == "granted"}
        else:
            # System User tokenlarida /me/permissions ishlamaydi — debug_token
            dbg = get(client, "debug_token", token, input_token=token)
            granted = set((dbg.get("data") or {}).get("scopes") or [])

        if not granted:
            print(f"{WARN} Ruxsatlar ro'yxatini o'qib bo'lmadi (System User tokenida normal).")
            print("        Quyidagi tekshiruvlar haqiqiy holatni ko'rsatadi.")
        else:
            for scope, why in NEEDED.items():
                mark = OK if scope in granted else NO
                print(f"{mark} {scope:<28} — {why}")

        # --- 3. Reklama akkauntlari ---
        print("\nREKLAMA AKKAUNTLARI (META_AD_ACCOUNT_ID uchun):")
        ad_account_id = None
        accounts = get(
            client, "me/adaccounts", token, fields="id,account_id,name,currency,account_status"
        )
        if "error" in accounts:
            print(f"{NO} O'qib bo'lmadi: {accounts['error'].get('message')}")
            print("        Odatda ads_read ruxsati yo'qligini bildiradi.")
        elif not accounts.get("data"):
            print(f"{NO} Bitta ham reklama akkaunti ko'rinmadi.")
            print("        Token Business Manager'dagi akkauntga ulanmagan bo'lishi mumkin.")
        else:
            for a in accounts["data"]:
                status = "faol" if a.get("account_status") == 1 else "faol emas"
                print(f"{OK} {a.get('name')} — {a.get('account_id')} "
                      f"({a.get('currency')}, {status})")
                if ad_account_id is None:
                    ad_account_id = a.get("account_id")

        # --- 4. Instagram business akkaunt ---
        print("\nINSTAGRAM AKKAUNT (IG_BUSINESS_ID uchun):")
        ig_id = None
        pages = get(
            client, "me/accounts", token, fields="name,instagram_business_account{id,username}"
        )
        if "error" in pages:
            print(f"{NO} O'qib bo'lmadi: {pages['error'].get('message')}")
            print("        pages_show_list ruxsati kerak.")
        elif not pages.get("data"):
            print(f"{NO} Facebook sahifa ko'rinmadi.")
            print("        Instagram business akkaunt Facebook sahifaga bog'langan bo'lishi shart.")
        else:
            for p in pages["data"]:
                iba = p.get("instagram_business_account")
                if iba:
                    print(f"{OK} {p.get('name')} → @{iba.get('username')} (id {iba.get('id')})")
                    if ig_id is None:
                        ig_id = iba.get("id")
                else:
                    print(f"{WARN} {p.get('name')} — Instagram akkaunt bog'lanmagan")

        # --- 5. Haqiqiy o'qish sinovi ---
        print("\nAMALIY SINOV:")
        if ad_account_id:
            ins = get(
                client,
                f"act_{ad_account_id}/insights",
                token,
                fields="spend",
                date_preset="last_7d",
            )
            if "error" in ins:
                print(f"{NO} Xarajat o'qilmadi: {ins['error'].get('message')}")
            else:
                rows = ins.get("data", [])
                spent = rows[0].get("spend") if rows else "0"
                print(f"{OK} Reklama xarajati o'qildi (so'nggi 7 kun: {spent})")
        if ig_id:
            ins = get(client, f"{ig_id}/insights", token, metric="reach", period="day")
            if "error" in ins:
                print(f"{NO} Insights o'qilmadi: {ins['error'].get('message')}")
            else:
                print(f"{OK} Instagram statistikasi o'qildi")

    # --- 6. Natija ---
    print("\n" + "=" * 62)
    if ad_account_id or ig_id:
        print(".env FAYLIGA QO'YING:")
        print("=" * 62)
        print("META_ACCESS_TOKEN=<yuqorida kiritgan tokeningiz>")
        if ad_account_id:
            print(f"META_AD_ACCOUNT_ID={ad_account_id}")
        if ig_id:
            print(f"IG_BUSINESS_ID={ig_id}")
        print("\nSo'ng: sudo systemctl restart gsr-jarvis")
    else:
        print("Kerakli ID'lar topilmadi — yuqoridagi [YO'Q] qatorlarga qarang.")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    main()
