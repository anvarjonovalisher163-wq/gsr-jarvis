"""Application settings, loaded from the repo-root .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent   # .../backend
REPO_ROOT = BACKEND_DIR.parent
SYSTEM_PROMPT_FILE = Path(__file__).resolve().parent / "prompts" / "system_prompt.txt"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # .env is looked up at the repo root first, then next to backend/
        env_file=[str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Claude ---
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 2048
    claude_plan_max_tokens: int = 8000
    chat_history_window: int = 20

    # --- Owner auth ---
    owner_login: str = "owner"
    owner_password_hash: str = ""
    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 43200

    # --- Meta / Instagram ---
    meta_access_token: str = ""
    ig_business_id: str = ""
    meta_graph_version: str = "v21.0"
    # Ad account id for spend/ROI sync, digits only or with the act_ prefix
    meta_ad_account_id: str = ""

    # --- Web push ---
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"

    # --- CRM integration (webhook) ---
    # Shared secret sent by the CRM in the X-CRM-Secret header. Empty means
    # the webhook endpoint is closed.
    crm_webhook_secret: str = ""
    # A lead with no CRM activity for this many days counts as "sovigan".
    stale_lead_days: int = 14

    # --- Competitor intel ---
    competitor_scrape_enabled: bool = False

    # --- Image generation ---
    image_provider: str = "stub"
    image_provider_api_key: str = ""
    image_quality: str = "medium"  # low | medium | high (OpenAI cost/quality tradeoff)
    # Public origin used to build the URL Meta/Instagram fetches generated
    # images from. Prod: https://jarvis.gsr.uz. Dev: https://localhost:5173
    # (proxied to the backend, see vite.config.js) — Instagram itself can
    # never reach a local/LAN address, so real publishing only works from
    # the real VPS regardless of this setting.
    public_base_url: str = ""

    # --- Misc ---
    timezone: str = "Asia/Tashkent"
    database_url: str = "sqlite:///./jarvis.db"
    cors_origins: str = "*"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def load_system_prompt() -> str:
    """The agent's system prompt lives in an editable text file."""
    return SYSTEM_PROMPT_FILE.read_text(encoding="utf-8").strip()
