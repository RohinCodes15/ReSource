"""Optional Supabase persistence. Without credentials, reports are kept in memory."""
import logging
import uuid
from typing import Any

from config import SUPABASE_KEY, SUPABASE_URL

log = logging.getLogger("resource.db")

_memory_reports: list[dict[str, Any]] = []
_client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client

        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:  # bad credentials or missing package: fall back to memory
        log.exception("Could not initialise Supabase; storing reports in memory")


def save_report(report: dict[str, Any]) -> tuple[str, str]:
    """Returns (report_id, storage_backend)."""
    report_id = str(uuid.uuid4())
    row = {"id": report_id, **report}
    if _client is not None:
        try:
            _client.table("reports").insert(row).execute()
            return report_id, "supabase"
        except Exception:
            log.exception("Supabase insert failed; keeping report in memory")
    _memory_reports.append(row)
    return report_id, "memory"
