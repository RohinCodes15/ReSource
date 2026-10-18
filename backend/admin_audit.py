"""Append-only audit records for successful administrator writes."""
from __future__ import annotations

import json
import os
import threading
from datetime import UTC, datetime

from settings import get_settings

_lock = threading.Lock()


def record_admin_action(action: str, resource_id: str) -> None:
    """Append a timestamp, action and resource ID without storing request contents or identity."""
    settings = get_settings()
    settings.state_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "timestamp": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "action": action,
        "resource_id": str(resource_id),
    }
    line = json.dumps(record, separators=(",", ":"), ensure_ascii=False) + "\n"
    path = settings.state_dir / "admin_audit.jsonl"
    with _lock:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
            os.write(descriptor, line.encode("utf-8"))
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
