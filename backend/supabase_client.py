"""Shared server-side Supabase client.

main.py and the routers all import `supabase` from here, so the client is created once and
no module has to import main.py (which would be a circular import).
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()
logger = logging.getLogger("resource.supabase")


def create_supabase_client() -> Client | None:
    url = os.getenv("SUPABASE_URL")
    # Keep the service-role key on the server. The anon key can read public catalogs, but cannot
    # safely support private report queries or writes under the schema's RLS policies.
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
        logger.exception("Could not initialize Supabase client")
        return None


# None when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.
supabase: Client | None = create_supabase_client()
