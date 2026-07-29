"""Test fixtures.

Environment is pinned BEFORE the app is imported so tests never touch the
real jarvis.db or depend on the owner's actual credentials. Run from the
backend/ directory:

    venv/Scripts/python -m pytest tests -q      (Windows)
    venv/bin/python -m pytest tests -q          (VPS)
"""
import os
import tempfile

_TMP_DB = os.path.join(tempfile.gettempdir(), "jarvis_pytest.db")
if os.path.exists(_TMP_DB):
    os.remove(_TMP_DB)

os.environ["DATABASE_URL"] = "sqlite:///" + _TMP_DB.replace("\\", "/")
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test"
os.environ["OWNER_LOGIN"] = "owner"
# bcrypt hash of "test-parol"
os.environ["OWNER_PASSWORD_HASH"] = (
    "$2b$12$UjMuAJvLW0CjaLcbQvKh/eGtEqL2fJUzX8hMlaCsc5g3lYcpCFXt6"
)
os.environ["JWT_SECRET"] = "pytest-secret"
os.environ["CRM_WEBHOOK_SECRET"] = "pytest-crm-secret"
os.environ["META_ACCESS_TOKEN"] = ""
os.environ["META_AD_ACCOUNT_ID"] = ""

import bcrypt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Regenerate the hash once per session in case the pinned one ever rots.
os.environ["OWNER_PASSWORD_HASH"] = bcrypt.hashpw(
    b"test-parol", bcrypt.gensalt(rounds=4)
).decode()

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def owner_headers(client):
    r = client.post("/api/auth/login", json={"login": "owner", "password": "test-parol"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def crm_headers():
    return {"X-CRM-Secret": "pytest-crm-secret"}
