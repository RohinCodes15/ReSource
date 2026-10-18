"""Malformed UUIDs are rejected before they reach Supabase's query builder."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from store import SupabaseStore


class NoDatabaseCalls:
    def table(self, name):
        pytest.fail(f"Supabase query was created for invalid {name} identifier")


@pytest.mark.parametrize(
    "call",
    [
        lambda store: store.get("reports", "not-a-uuid"),
        lambda store: store.update("reports", "not-a-uuid", {"status": "verified"}),
        lambda store: store.get("deletion_requests", "bad-id"),
        lambda store: store.delete("email_subscriptions", {"id": "bad-id"}),
        lambda store: store.delete("post_flags", {"post_id": "bad-id"}),
    ],
)
def test_invalid_uuid_store_ids_return_400_without_query(call):
    store = SupabaseStore(NoDatabaseCalls(), "unused")
    with pytest.raises(HTTPException) as error:
        call(store)
    assert error.value.status_code == 400
    assert error.value.detail == "invalid_id"


def test_text_catalog_ids_are_not_treated_as_uuids():
    from store import _validate_supabase_uuid

    _validate_supabase_uuid("services", "id", "svc-pavement")
    _validate_supabase_uuid("resources", "id", "res-food-tcv")
