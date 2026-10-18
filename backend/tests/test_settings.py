"""Environment-driven setting defaults."""
import re
from datetime import date
from pathlib import Path

import pytest

from settings import POLICY_VERSION, get_settings


def test_account_required_defaults_to_false(env):
    env.delenv("ACCOUNT_REQUIRED", raising=False)
    get_settings.cache_clear()
    try:
        assert get_settings().account_required is False
    finally:
        get_settings.cache_clear()


def test_config_exposes_account_required_from_env(client, env):
    for value, expected in (("false", False), ("true", True)):
        env.setenv("ACCOUNT_REQUIRED", value)
        get_settings.cache_clear()
        response = client.get("/config")
        assert response.status_code == 200
        assert response.json()["account_required"] is expected


def test_policy_versions_match_shared_constants():
    shared = (Path(__file__).resolve().parents[2] / "shared" / "constants.ts").read_text()
    version = re.search(r"export const POLICY_VERSION = ['\"]([^'\"]+)['\"];", shared)
    assert version is not None
    assert version.group(1) == POLICY_VERSION
    assert date.fromisoformat(POLICY_VERSION).isoformat() == POLICY_VERSION


@pytest.mark.parametrize("length", [1, 23])
def test_configured_admin_token_must_be_at_least_24_characters(env, length):
    env.setenv("ADMIN_TOKEN", "x" * length)
    get_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="ADMIN_TOKEN must be at least 24 characters"):
            get_settings()
    finally:
        get_settings.cache_clear()
