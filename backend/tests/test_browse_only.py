"""B20 regression contracts for the existing under-13 gates (app files are read only).

These source checks cover the specific feedback/vote/flag omissions from the review;
actual native UI interaction still belongs to the frontend test suite.
"""
from pathlib import Path

import pytest
from conftest import ALICE, CONSENT, report_body

from store import get_store

APP = Path(__file__).resolve().parents[2] / "app" / "src" / "app" / "(tabs)"


def test_feedback_and_community_controls_keep_browse_only_gates():
    settings = (APP / "settings.tsx").read_text()
    community = (APP / "community.tsx").read_text()
    feedback = settings[settings.index('testID="feedback-form"'):settings.index('testID="confirm-delete"')]
    assert "{age === 'under13' ? <BrowseOnly /> : (" in feedback
    assert 'testID="feedback-send"' in feedback
    vote = community[community.index('onPress={() => vote(post)}'):community.index('testID={`vote-${post.id}`}')]
    assert "disabled={bundled || age === 'under13' || busyId === post.id}" in vote
    flag = community[community.index("{!bundled && !post.is_sample"):community.index('testID={`flag-${post.id}`}')]
    assert "age !== 'under13' && (" in flag


@pytest.mark.parametrize("route,payload", [
    ("/reports", report_body(age_confirmed=False)),
    ("/posts", {"body": "A tip from an under-13 user", "area": "citywide", **CONSENT, "age_confirmed": False}),
    ("/email/subscribe", {"email": "child@example.test", "areas": [], "categories": [], **CONSENT, "age_confirmed": False}),
])
def test_disclosed_under13_contributions_are_rejected_before_storage(client, route, payload):
    store = get_store()
    before = {table: store.count(table) for table in ("reports", "posts", "email_subscriptions", "consent_records")}
    assert client.post(route, json=payload, headers=ALICE).status_code == 422
    assert {table: store.count(table) for table in before} == before
