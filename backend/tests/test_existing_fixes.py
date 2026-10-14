"""Review regressions for the existing B30/B31/B32 fixes; no live database."""
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from conftest import BOB

from store import StoreError, SupabaseStore, get_store, reset_store


@pytest.mark.parametrize("action,table", [("vote", "post_votes"), ("flag", "post_flags")])
@pytest.mark.parametrize("duplicate", [True, False])
def test_duplicate_writes_are_tolerated_but_real_failures_propagate(client, monkeypatch, action, table, duplicate):
    store = get_store()
    post = store.insert("posts", {"body": "A useful community tip", "status": "approved", "upvotes": 0})
    original = store.insert

    def insert(name, row):
        if name == table:
            if duplicate:
                original(name, row)  # the other request won the unique-key race
            raise StoreError("simulated database failure")
        return original(name, row)

    monkeypatch.setattr(store, "insert", insert)
    response = client.post(f"/posts/{post['id']}/{action}", headers=BOB)
    assert response.status_code == (200 if duplicate else 502)


def test_supabase_startup_failure_does_not_fall_back(client, env, monkeypatch):
    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake-key")
    reset_store()

    def fail(*args):
        raise RuntimeError("client unavailable")

    monkeypatch.setattr("supabase.create_client", fail)
    with pytest.raises(RuntimeError, match="could not start"):
        get_store()
    assert not (Path(get_store.__globals__["get_settings"]().state_dir) / "state.json").exists()


def test_supabase_list_reads_every_page():
    class Query:
        def select(self, *_):
            return self

        def range(self, start, end):
            self.start, self.end = start, end
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": i} for i in range(self.start, min(self.end + 1, 2010))])

    store = SupabaseStore(SimpleNamespace(table=lambda _: Query()), "photos")
    assert len(store.list("reports")) == 2010


@pytest.mark.parametrize("args,writes", [([], 0), (["--dry-run"], 0), (["--write"], 1), (["--write", "--dry-run"], 0)])
def test_scraper_defaults_to_preview_and_writes_explicit_ids(monkeypatch, args, writes):
    path = Path(__file__).parents[2] / "scraper" / "upload_to_supabase.py"
    spec = importlib.util.spec_from_file_location("upload_review", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    inserted = []

    class Query:
        def select(self, *_):
            return self

        def insert(self, row):
            inserted.append(row)
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    monkeypatch.setattr(module, "connect", lambda: SimpleNamespace(table=lambda _: Query()))
    monkeypatch.setattr(module, "load_records", lambda: [{"name": "Niles Library", "cut_amount": 100}])
    monkeypatch.setattr(sys, "argv", ["upload_to_supabase.py", *args])
    assert module.main() == 0
    assert len(inserted) == writes
    if writes:
        assert inserted[0]["id"] == "svc-niles-library"


@pytest.mark.parametrize("table", ["post_votes", "post_flags"])
def test_local_mode_has_atomic_unique_community_actions(client, table):
    from concurrent.futures import ThreadPoolExecutor

    store = get_store()
    def insert(_):
        try:
            store.insert(table, {"post_id": "test-post", "owner_hash": "same-owner"})
            return True
        except StoreError:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(insert, range(2))) == 1
    assert store.count(table, {"post_id": "test-post", "owner_hash": "same-owner"}) == 1
