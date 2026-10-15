"""Short-lived server-authored chat history; caller-supplied assistant turns are ignored.

History exists only in RAM for ten minutes, keyed by the existing HMAC owner id and language.
The maximum session count and content size bound memory. Restarts safely start a new chat.
"""
import threading
import time
from collections import OrderedDict


class ChatSessions:
    TTL = 600
    MAX_SESSIONS = 1000
    MAX_CHARS = 8000

    def __init__(self):
        self._entries = OrderedDict()
        self._lock = threading.Lock()

    def history(self, owner, language):
        if not owner:
            return []
        with self._lock:
            key = (owner, language)
            entry = self._entries.get(key)
            if not entry or time.monotonic() - entry[0] >= self.TTL:
                self._entries.pop(key, None)
                return []
            return [dict(turn) for turn in entry[1]]

    def save(self, owner, language, turns, reply):
        if not owner:
            return
        history = [*turns, {"role": "assistant", "content": reply}]
        while history and (len(history) > 20 or sum(len(t["content"]) for t in history) > self.MAX_CHARS):
            history.pop(0)
        while history and history[0]["role"] != "user":
            history.pop(0)
        now = time.monotonic()
        with self._lock:
            for key in list(self._entries):
                if now - self._entries[key][0] >= self.TTL:
                    del self._entries[key]
            key = (owner, language)
            self._entries[key] = (now, history)
            self._entries.move_to_end(key)
            while len(self._entries) > self.MAX_SESSIONS:
                self._entries.popitem(last=False)

    def forget(self, owner, language=None):
        with self._lock:
            for key in list(self._entries):
                if key[0] == owner and (language is None or key[1] == language):
                    del self._entries[key]

    def reset(self):
        with self._lock:
            self._entries.clear()


sessions = ChatSessions()
