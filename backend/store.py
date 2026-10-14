"""Data access for the API, with two interchangeable backends.

`SupabaseStore` talks to Postgres through Supabase using the server-side service-role key.
`LocalStore` serves the bundled JSON in shared/data and keeps anything residents write
(reports, posts, votes, subscriptions) in backend/.local_state/state.json.

Routers only ever call `get_store()` and the handful of methods below, so every route behaves
the same in both modes. Reference documents that change only when the data pipeline runs
(council roster, budget votes, budget figures, ZIP table) are read from shared/data in both modes.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from typing import Any

from settings import get_settings

logger = logging.getLogger("resource.store")

CATALOG_TABLES = ("services", "resources", "alerts")
USER_TABLES = (
    "reports", "posts", "post_votes", "post_flags", "subscriptions", "email_subscriptions",
    "consent_records", "deletion_requests", "feedback",
)
REFERENCE_FILES = ("council", "votes", "budget", "zips")
Row = dict[str, Any]


class StoreError(Exception):
    """The database could not be reached or rejected the request."""


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@cache
def _reference_cached(data_dir: str, name: str) -> Any:
    return _read_json(Path(data_dir) / f"{name}.json")


def reference(name: str) -> Any:
    """A read-only reference document: 'council', 'votes', 'budget' or 'zips'."""
    if name not in REFERENCE_FILES:
        raise KeyError(name)
    return _reference_cached(str(get_settings().data_dir), name)


def _matches(row: Row, filters: Row | None) -> bool:
    return all(row.get(key) == value for key, value in (filters or {}).items())


class LocalStore:
    """Zero-account mode: bundled catalogs plus a JSON state file for user-written rows."""

    mode = "local"

    def __init__(self, data_dir: Path, state_dir: Path) -> None:
        self._lock = threading.RLock()
        self._state_dir = state_dir
        self._state_file = state_dir / "state.json"
        self._tables: dict[str, list[Row]] = {name: _read_json(data_dir / f"{name}.json") for name in CATALOG_TABLES}
        state: dict[str, Any] = {}
        if self._state_file.exists():
            try:
                state = _read_json(self._state_file)
            except (OSError, ValueError):
                logger.exception("Could not read %s; starting with empty local state", self._state_file)
        for name in USER_TABLES:
            self._tables[name] = list(state.get(name, []))
        if "posts" not in state:  # first run: start the board with the labeled starter posts
            self._tables["posts"] = [dict(post, owner_hash=None) for post in _read_json(data_dir / "posts.json")]
        # Admin edits to catalog rows are kept apart from the seed files and re-applied on start.
        self._catalog_edits: dict[str, dict[str, Row]] = state.get("_catalog_edits", {})
        for table, edits in self._catalog_edits.items():
            for row in self._tables.get(table, []):
                row.update(edits.get(row["id"], {}))

    def _persist(self) -> None:
        payload = {name: self._tables[name] for name in USER_TABLES}
        payload["_catalog_edits"] = self._catalog_edits
        try:
            self._state_dir.mkdir(parents=True, exist_ok=True)
            temp = self._state_file.with_suffix(".tmp")
            temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            os.replace(temp, self._state_file)
        except OSError:
            logger.exception("Could not write local state; changes are kept in memory only")

    def list(self, table: str, filters: Row | None = None, order: str | None = None,
             desc: bool = False, limit: int | None = None) -> list[Row]:
        with self._lock:
            rows = [dict(row) for row in self._tables[table] if _matches(row, filters)]
        if order:
            rows.sort(key=lambda row: (row.get(order) is None, row.get(order) or ""), reverse=desc)
        return rows[:limit] if limit else rows

    def get(self, table: str, row_id: str) -> Row | None:
        with self._lock:
            return next((dict(row) for row in self._tables[table] if row.get("id") == row_id), None)

    def insert(self, table: str, row: Row) -> Row:
        new_row = {"id": str(uuid.uuid4()), "created_at": now_iso(), **row}
        with self._lock:
            self._tables[table].append(new_row)
            self._persist()
        return dict(new_row)

    def update(self, table: str, row_id: str, changes: Row) -> Row | None:
        with self._lock:
            for row in self._tables[table]:
                if row.get("id") == row_id:
                    row.update(changes)
                    if table in CATALOG_TABLES:
                        self._catalog_edits.setdefault(table, {}).setdefault(row_id, {}).update(changes)
                    self._persist()
                    return dict(row)
        return None

    def delete(self, table: str, filters: Row) -> int:
        if not filters:
            raise ValueError("delete() needs at least one filter")
        with self._lock:
            before = len(self._tables[table])
            self._tables[table] = [row for row in self._tables[table] if not _matches(row, filters)]
            removed = before - len(self._tables[table])
            if removed:
                self._persist()
        return removed

    def count(self, table: str, filters: Row | None = None) -> int:
        with self._lock:
            return sum(1 for row in self._tables[table] if _matches(row, filters))

    def save_file(self, name: str, data: bytes, content_type: str) -> str:
        folder = self._state_dir / "uploads"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / name).write_bytes(data)
        return f"local:{name}"

    def read_file(self, path: str) -> bytes | None:
        file = self._state_dir / "uploads" / path.removeprefix("local:")
        return file.read_bytes() if path.startswith("local:") and file.is_file() else None

    def delete_file(self, path: str) -> None:
        if path.startswith("local:"):
            (self._state_dir / "uploads" / path.removeprefix("local:")).unlink(missing_ok=True)


class SupabaseStore:
    """Live mode. Uses the service-role key, so it must only ever run on the server."""

    mode = "supabase"

    def __init__(self, client: Any, bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    def _run(self, query: Any) -> Any:
        try:
            return query.execute()
        except Exception as exc:  # network failure, bad credentials, constraint violation
            logger.exception("Supabase request failed")
            raise StoreError("The database request failed") from exc

    @staticmethod
    def _filtered(query: Any, filters: Row | None) -> Any:
        for key, value in (filters or {}).items():
            query = query.is_(key, "null") if value is None else query.eq(key, value)
        return query

    PAGE = 1000

    def list(self, table: str, filters: Row | None = None, order: str | None = None,
             desc: bool = False, limit: int | None = None) -> list[Row]:
        query = self._filtered(self.client.table(table).select("*"), filters)
        if order:
            query = query.order(order, desc=desc)
        if limit:
            return self._run(query.limit(limit)).data or []
        # Supabase returns at most PAGE rows per request, so read every page.
        rows: list[Row] = []
        while True:
            page = self._run(query.range(len(rows), len(rows) + self.PAGE - 1)).data or []
            rows += page
            if len(page) < self.PAGE:
                return rows

    def get(self, table: str, row_id: str) -> Row | None:
        rows = self._run(self.client.table(table).select("*").eq("id", row_id).limit(1)).data or []
        return rows[0] if rows else None

    def insert(self, table: str, row: Row) -> Row:
        rows = self._run(self.client.table(table).insert(row)).data or []
        if not rows:
            raise StoreError("The database did not return the new row")
        return rows[0]

    def update(self, table: str, row_id: str, changes: Row) -> Row | None:
        rows = self._run(self.client.table(table).update(changes).eq("id", row_id)).data or []
        return rows[0] if rows else None

    def delete(self, table: str, filters: Row) -> int:
        if not filters:
            raise ValueError("delete() needs at least one filter")
        return len(self._run(self._filtered(self.client.table(table).delete(), filters)).data or [])

    def count(self, table: str, filters: Row | None = None) -> int:
        query = self._filtered(self.client.table(table).select("id", count="exact"), filters)
        return self._run(query.limit(1)).count or 0

    def save_file(self, name: str, data: bytes, content_type: str) -> str:
        try:
            self.client.storage.from_(self.bucket).upload(name, data, {"content-type": content_type})
        except Exception as exc:
            logger.exception("Supabase Storage upload failed")
            raise StoreError("The photo could not be stored") from exc
        return f"{self.bucket}/{name}"

    def read_file(self, path: str) -> bytes | None:
        try:
            return self.client.storage.from_(self.bucket).download(path.split("/", 1)[-1])
        except Exception:
            logger.exception("Supabase Storage download failed for %s", path)
            return None

    def delete_file(self, path: str) -> None:
        try:
            self.client.storage.from_(self.bucket).remove([path.split("/", 1)[-1]])
        except Exception:
            logger.exception("Supabase Storage delete failed for %s", path)


_store: LocalStore | SupabaseStore | None = None
_store_lock = threading.Lock()


def get_store() -> LocalStore | SupabaseStore:
    global _store
    with _store_lock:
        if _store is None:
            settings = get_settings()
            if settings.use_supabase:
                try:
                    from supabase import create_client

                    _store = SupabaseStore(
                        create_client(settings.supabase_url, settings.supabase_service_role_key),
                        settings.storage_bucket,
                    )
                except Exception as exc:
                    # Never fall back to local files here: reports would be written to a disk
                    # that the next deploy erases, while the API looked healthy.
                    logger.exception("Could not start the Supabase client")
                    raise RuntimeError("SUPABASE_URL is set but the Supabase client could not start") from exc
            if _store is None:
                _store = LocalStore(settings.data_dir, settings.state_dir)
            logger.info("ReSource store running in %s mode", _store.mode)
        return _store


def reset_store() -> None:
    """Forget the cached store and settings (used by tests)."""
    global _store
    with _store_lock:
        _store = None
    get_settings.cache_clear()
    _reference_cached.cache_clear()
