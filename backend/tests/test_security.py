"""Regression tests for IP, owner and global chat limits; no provider calls."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from conftest import ALICE, restart
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from security import RateLimiter, client_fingerprint, owner_from, owners_from, rate_limit
from settings import get_settings

CHAT_BODY = {"messages": [{"role": "user", "content": "free food"}]}


def request(ip, token=None):
    headers = [(b"x-client-token", token.encode())] if token else []
    return Request({"type": "http", "headers": headers, "client": (ip, 1234)})


def signed_request(account, device=None):
    req = request("192.0.2.1", device)
    req.scope["headers"].append((b"authorization", f"Bearer session-{account}".encode()))
    req.state.resource_user = {"id": account, "role": None}
    return req


def test_same_account_on_two_devices_has_different_owner_hashes(client):
    first = signed_request("account-1", "install-token-device-one")
    second = signed_request("account-1", "install-token-device-two")
    assert owner_from(first) is not None
    assert owner_from(second) is not None
    assert owner_from(first) != owner_from(second)
    assert owners_from(first) == [owner_from(first)]
    assert owners_from(second) == [owner_from(second)]
    assert owner_from(signed_request("account-1")) is None
    assert owners_from(signed_request("account-1")) == []


def test_two_accounts_on_one_device_have_same_owner_hash(client):
    first = signed_request("account-1", "install-token-same-device")
    second = signed_request("account-2", "install-token-same-device")
    assert owner_from(first) is not None
    assert owner_from(first) == owner_from(second)
    assert owners_from(first) == owners_from(second) == [owner_from(first)]


@pytest.mark.parametrize("path", ["/chat", "/chat/stream"])
def test_rotating_tokens_cannot_bypass_ip_bucket(client, env, path):
    env.setenv("RATE_LIMIT_ENABLED", "1")
    restart()
    codes = [client.post(path, json=CHAT_BODY, headers={
        "X-Client-Token": f"rotating-install-token-{i:04d}",
    }).status_code for i in range(13)]
    assert codes == [200] * 12 + [429]


@pytest.mark.parametrize("token", [None, "invalid", ALICE["X-Client-Token"]])
def test_ip_bucket_applies_with_or_without_valid_token(client, env, token):
    env.setenv("RATE_LIMIT_ENABLED", "1")
    restart()
    check = rate_limit("regression", 2, 60)
    req = request("192.0.2.1", token)
    check(req)
    check(req)
    with pytest.raises(HTTPException) as error:
        check(req)
    assert error.value.status_code == 429
    assert int(error.value.headers["Retry-After"]) > 0
    check(request("192.0.2.2", "another-install-token-0001"))


def test_owner_bucket_applies_across_ips(client, env):
    env.setenv("RATE_LIMIT_ENABLED", "1")
    restart()
    check = rate_limit("regression", 2, 60)
    token = ALICE["X-Client-Token"]
    check(request("192.0.2.1", token))
    check(request("192.0.2.2", token))
    with pytest.raises(HTTPException) as error:
        check(request("192.0.2.3", token))
    assert error.value.status_code == 429


def test_fingerprint_depends_only_on_ip(client):
    first = client_fingerprint(request("192.0.2.1", "install-token-number-one"))
    assert first == client_fingerprint(request("192.0.2.1", "install-token-number-two"))
    assert first == client_fingerprint(request("192.0.2.1"))
    assert first != client_fingerprint(request("192.0.2.2"))
    assert "192.0.2.1" not in first


def test_global_cap_shared_across_ips_tokens_and_chat_routes(client, env, monkeypatch):
    import security

    env.setenv("RATE_LIMIT_ENABLED", "1")
    env.setenv("CHAT_GLOBAL_DAILY_LIMIT", "3")
    restart()
    clock = [100.0]
    monkeypatch.setattr(security.time, "monotonic", lambda: clock[0])
    for i, path in enumerate(("/chat", "/chat/stream", "/chat")):
        with TestClient(client.app, client=(f"192.0.2.{i + 1}", 1234)) as other:
            assert other.post(path, json=CHAT_BODY, headers={
                "X-Client-Token": f"different-install-token-{i:04d}",
            }).status_code == 200
    with TestClient(client.app, client=("192.0.2.99", 1234)) as other:
        for path in ("/chat", "/chat/stream"):
            response = other.post(path, json=CHAT_BODY)
            assert response.status_code == 429
            assert response.json()["detail"] == "rate_limited"
            assert int(response.headers["Retry-After"]) > 0
        clock[0] += 3601
        assert other.post("/chat", json=CHAT_BODY).status_code == 429
        assert other.get("/services").status_code == 200
        clock[0] = 86500.0
        assert other.post("/chat/stream", json=CHAT_BODY).status_code == 200


def test_limits_can_be_disabled_for_local_tests(client, env):
    env.setenv("CHAT_GLOBAL_DAILY_LIMIT", "1")
    restart()
    assert [client.post("/chat", json=CHAT_BODY).status_code for _ in range(14)] == [200] * 14


def test_daily_counter_survives_stale_bucket_cleanup(monkeypatch):
    import security

    clock = [0.0]
    monkeypatch.setattr(security.time, "monotonic", lambda: clock[0])
    limiter = RateLimiter()
    limiter.check("global-day", 1, 86400)
    for i in range(20000):
        limiter.check(f"short-{i}", 1, 60)
    clock[0] = 3601.0
    limiter.check("cleanup-trigger", 1, 60)
    with pytest.raises(HTTPException):
        limiter.check("global-day", 1, 86400)
    assert len(limiter._hits) == 2


def test_concurrent_global_checks_do_not_exceed_cap():
    limiter = RateLimiter()

    def attempt(_):
        try:
            limiter.check("global-day", 5, 86400)
            return True
        except HTTPException as error:
            assert error.status_code == 429
            return False

    with ThreadPoolExecutor(max_workers=10) as pool:
        assert sum(pool.map(attempt, range(40))) == 5


@pytest.mark.parametrize("value", ["0", "-1", "not-an-integer"])
def test_global_cap_must_be_positive(env, value):
    env.setenv("CHAT_GLOBAL_DAILY_LIMIT", value)
    get_settings.cache_clear()
    with pytest.raises(ValueError):
        get_settings()
    get_settings.cache_clear()
