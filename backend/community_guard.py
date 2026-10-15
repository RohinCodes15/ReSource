"""Temporary network buckets for community integrity; no IP-derived values reach disk.

Single-process protection, like the rate limiter. Entries expire after 24 hours; restarting
forgets them, so a shared ephemeral store is required before using multiple API workers.
"""
import threading
import time

from fastapi import HTTPException


class CommunityGuard:
    WINDOW = 86400

    def __init__(self):
        self._entries = {}
        self._lock = threading.Lock()

    def record(self, kind: str, post_id: str, network: str, owner: str) -> int:
        now = time.monotonic()
        with self._lock:
            for key in list(self._entries):
                entries = self._entries[key]
                for ip in list(entries):
                    if now - entries[ip][1] >= self.WINDOW:
                        del entries[ip]
                if not entries:
                    del self._entries[key]
            entries = self._entries.setdefault((kind, post_id), {})
            existing = entries.get(network)
            if existing and existing[0] != owner:
                if kind == "vote":
                    raise HTTPException(status_code=409, detail="network_already_voted")
                return len({value[0] for value in entries.values()})
            # One owner on many networks still contributes only one to the flag quorum.
            entries.setdefault(network, (owner, now))
            return len({value[0] for value in entries.values()})

    def clear_flags(self, post_id: str) -> None:
        with self._lock:
            self._entries.pop(("flag", post_id), None)

    def reset(self) -> None:
        with self._lock:
            self._entries.clear()


guard = CommunityGuard()
