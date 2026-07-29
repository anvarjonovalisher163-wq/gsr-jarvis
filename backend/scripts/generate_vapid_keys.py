"""Generate a VAPID key pair for Web Push.

Usage (from backend/ with the venv active):
    python scripts/generate_vapid_keys.py
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
private_raw = key.private_numbers().private_value.to_bytes(32, "big")
public_raw = key.public_key().public_bytes(
    serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
)

print(".env fayliga qo'ying:")
print("VAPID_PUBLIC_KEY=" + b64url(public_raw))
print("VAPID_PRIVATE_KEY=" + b64url(private_raw))
