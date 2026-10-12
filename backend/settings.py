"""Environment-driven settings for the ReSource API.

Every variable is optional. With none set the API runs in "local" mode: it serves the bundled
data in shared/data and keeps reports, posts and subscriptions in backend/.local_state, so the
whole stack works with zero accounts. deployment/ENV.md lists every variable.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

# Bumped whenever the Privacy Policy or Terms change; stored with each consent record.
POLICY_VERSION = "2026-10-12"
DEFAULT_CORS = "http://localhost:8081,http://localhost:19006,http://localhost:3000"
DEFAULT_MODEL = "claude-opus-5-5"


def _flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    storage_bucket: str
    anthropic_api_key: str
    claude_model: str
    cors_origins: tuple[str, ...]
    admin_token: str
    owner_salt: str
    data_dir: Path
    state_dir: Path
    trust_proxy: bool
    rate_limit_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    email_from: str
    public_api_url: str
    contact_email: str

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.email_from and self.public_api_url)


def _owner_salt(state_dir: Path, service_role_key: str) -> str:
    """Secret used to hash install tokens. Set OWNER_HASH_SALT in production.

    Without it: derive one from the service-role key (Supabase mode), or create a random one
    in the local state folder (local mode) so hashes survive a restart but never leave the machine.
    """
    configured = os.getenv("OWNER_HASH_SALT", "").strip()
    if configured:
        return configured
    if service_role_key:
        return hashlib.sha256(f"resource-owner-salt:{service_role_key}".encode()).hexdigest()
    salt_file = state_dir / "salt"
    try:
        if salt_file.exists():
            return salt_file.read_text(encoding="utf-8").strip()
        state_dir.mkdir(parents=True, exist_ok=True)
        salt = secrets.token_hex(32)
        salt_file.write_text(salt, encoding="utf-8")
        return salt
    except OSError:
        return secrets.token_hex(32)  # read-only disk: hashes last until the process restarts


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    state_dir = Path(os.getenv("LOCAL_STATE_DIR", BACKEND_DIR / ".local_state"))
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    origins = tuple(o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", DEFAULT_CORS).split(",") if o.strip())
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        supabase_service_role_key=service_role_key,
        storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "report-photos").strip(),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
        claude_model=os.getenv("CLAUDE_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        cors_origins=origins,
        admin_token=os.getenv("ADMIN_TOKEN", "").strip(),
        owner_salt=_owner_salt(state_dir, service_role_key),
        data_dir=Path(os.getenv("DATA_DIR", BACKEND_DIR.parent / "shared" / "data")),
        state_dir=state_dir,
        trust_proxy=_flag("TRUST_PROXY"),
        rate_limit_enabled=_flag("RATE_LIMIT_ENABLED", True),
        smtp_host=os.getenv("SMTP_HOST", "").strip(),
        smtp_port=int(os.getenv("SMTP_PORT", "587") or 587),
        smtp_user=os.getenv("SMTP_USER", "").strip(),
        smtp_password=os.getenv("SMTP_PASSWORD", ""),
        email_from=os.getenv("EMAIL_FROM", "").strip(),
        public_api_url=os.getenv("PUBLIC_API_URL", "").strip().rstrip("/"),
        contact_email=os.getenv("CONTACT_EMAIL", "").strip(),
    )
