"""Generate a bcrypt hash for OWNER_PASSWORD_HASH in .env.

Usage (from backend/ with the venv active):
    python scripts/hash_password.py
"""
import getpass

import bcrypt

pw = getpass.getpass("Yangi parol kiriting: ")
pw2 = getpass.getpass("Parolni qayta kiriting: ")
if pw != pw2:
    raise SystemExit("Parollar mos kelmadi.")
if len(pw) < 8:
    raise SystemExit("Parol kamida 8 belgidan iborat bo'lsin.")

print("\n.env fayliga qo'ying:")
print("OWNER_PASSWORD_HASH=" + bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode())
