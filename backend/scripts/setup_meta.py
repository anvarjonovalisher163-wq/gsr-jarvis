"""Meta token o'rnatish — bosqichma-bosqich yo'riqnoma + avtomatik tekshiruv.

CRM keyinroq ulanadi. Hozir faqat Meta.

Ishlatish:
    python scripts/setup_meta.py          # yo'riqnoma + tekshiruv
    python scripts/setup_meta.py --apply  # tekshiruv + .env ga yozish
"""
from __future__ import annotations

import argparse
import sys

from check_meta_token import apply_to_env, print_report, read_token, validate_token
from meta_env import diagnose_env

GUIDE = """
╔══════════════════════════════════════════════════════════════╗
║           META TOKEN OLISH (System User — tavsiya)           ║
╚══════════════════════════════════════════════════════════════╝

1. Instagram → Business akkaunt, Facebook sahifaga bog'langan bo'lsin

2. developers.facebook.com → ilova yarating
   Mahsulotlar: Marketing API + Instagram Graph API

3. business.facebook.com/settings → Users → System Users
   • Add → nom: jarvis, rol: Admin
   • Add Assets:
     - Ad Account → reklama akkauntingiz → View performance
     - Pages → Facebook sahifangiz → Full control
     - Instagram accounts → profilingiz

4. Generate New Token → ilovangizni tanlang
   Ruxsatlar:
     ads_read
     instagram_basic
     instagram_manage_insights
     pages_show_list
     instagram_content_publish
     pages_read_engagement

5. Token faqat BIR MARTA ko'rsatiladi — darhol nusxalang!

6. Repo ildizidagi .env fayliga yozing:
     META_ACCESS_TOKEN=EAAG...

7. Tekshirish va saqlash:
     python scripts/check_meta_token.py --apply

⚠️  Tokenni chatga yubormang — faqat .env fayliga!
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help=".env ga yozish")
    parser.add_argument("--guide-only", action="store_true", help="Faqat yo'riqnoma")
    args = parser.parse_args()

    print(GUIDE)

    if args.guide_only:
        return

    print("=" * 62)
    print("TEKSHIRUV")
    print("=" * 62)

    token = read_token(interactive=False)
    if not token:
        print("\n.env da META_ACCESS_TOKEN o'qilmadi.\n")
        for hint in diagnose_env():
            print(f"  • {hint}")
        print("\nYuqoridagi 6-qadamni bajaring, keyin qayta ishga tushiring:")
        print("  python scripts/setup_meta.py --apply")
        sys.exit(1)

    result = validate_token(token)
    print_report(token, result)

    if args.apply:
        if result["ok"]:
            apply_to_env(token, result)
        else:
            sys.exit(1)
    elif result["ok"]:
        print("\nHammasi yaxshi. Saqlash:")
        print("  python scripts/setup_meta.py --apply")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
