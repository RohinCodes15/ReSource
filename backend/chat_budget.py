"""A rolling 24-hour token budget for the assistant, shared by /chat and /chat/stream.

The request limits in security.py cap how often people can ask. This caps what the answers cost:
an open-ended assistant writes longer and more varied replies than the old lookup-only one, so
the token count, not the request count, is what bounds the bill. When the budget is spent, chat
keeps working in basic search mode until old usage ages out of the window.

Like chat_global_limit, the counter lives in this process: run one API worker.
"""
from __future__ import annotations

import threading
import time
from collections import deque

from settings import get_settings

WINDOW_SECONDS = 86400


class TokenBudget:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._spent: deque[tuple[float, int]] = deque()
        self._total = 0

    def _expire(self, now: float) -> None:
        while self._spent and self._spent[0][0] <= now - WINDOW_SECONDS:
            self._total -= self._spent.popleft()[1]

    def spent(self) -> int:
        with self._lock:
            self._expire(time.monotonic())
            return self._total

    def available(self) -> bool:
        return self.spent() < get_settings().chat_daily_token_budget

    def charge(self, tokens: int) -> None:
        if tokens <= 0:
            return
        with self._lock:
            now = time.monotonic()
            self._expire(now)
            self._spent.append((now, tokens))
            self._total += tokens

    def reset(self) -> None:
        with self._lock:
            self._spent.clear()
            self._total = 0


budget = TokenBudget()
