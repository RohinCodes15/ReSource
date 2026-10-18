"""Chat cost safeguards; provider requests are mocked."""
import pytest
from test_chat import FakeLLM

from routers.chat import (
    MAX_HISTORY_CHARS,
    MAX_TOKENS,
    AnthropicLLM,
    bounded_conversation,
)
from schemas import ChatIn
from settings import get_settings


@pytest.mark.parametrize("configured", [None, "", "  "])
def test_default_model_is_sonnet_5(client, env, configured):
    if configured is None:
        env.delenv("CLAUDE_MODEL", raising=False)
    else:
        env.setenv("CLAUDE_MODEL", configured)
    get_settings.cache_clear()
    assert get_settings().claude_model == "claude-sonnet-5"


def test_model_override_is_preserved(client, env):
    env.setenv("CLAUDE_MODEL", "claude-sonnet-5-5")
    get_settings.cache_clear()
    assert get_settings().claude_model == "claude-sonnet-5-5"


def test_output_budget_and_default_model_parameters(client, env):
    env.delenv("CLAUDE_MODEL", raising=False)
    get_settings.cache_clear()
    params = AnthropicLLM("test-key", get_settings().claude_model)._params([], [])
    assert params["model"] == "claude-sonnet-5" and params["output_config"] == {"effort": "low"}
    assert params["max_tokens"] == MAX_TOKENS == 1500
    assert "betas" not in params and "extra_body" not in params


def test_daily_token_budget_is_configurable_and_validated(client, env):
    env.delenv("CHAT_DAILY_TOKEN_BUDGET", raising=False)
    get_settings.cache_clear()
    assert get_settings().chat_daily_token_budget == 400_000
    env.setenv("CHAT_DAILY_TOKEN_BUDGET", "50000")
    get_settings.cache_clear()
    assert get_settings().chat_daily_token_budget == 50_000
    env.setenv("CHAT_DAILY_TOKEN_BUDGET", "0")
    get_settings.cache_clear()
    with pytest.raises(ValueError):
        get_settings()
    env.delenv("CHAT_DAILY_TOKEN_BUDGET")
    get_settings.cache_clear()


def test_token_budget_window_expires(monkeypatch):
    from chat_budget import WINDOW_SECONDS, TokenBudget

    clock = [1000.0]
    monkeypatch.setattr("chat_budget.time.monotonic", lambda: clock[0])
    tokens = TokenBudget()
    tokens.charge(300)
    tokens.charge(0)
    assert tokens.spent() == 300
    clock[0] += WINDOW_SECONDS
    assert tokens.spent() == 0


def test_history_boundary_preserves_recent_complete_turns():
    turns = [{"role": "user", "content": "u" * 2000},
             {"role": "assistant", "content": "a" * 4000},
             {"role": "user", "content": "q" * 2000}]
    assert sum(len(t["content"]) for t in turns) == MAX_HISTORY_CHARS
    assert bounded_conversation(ChatIn(messages=turns)) == turns
    turns[1]["content"] += "a"
    assert bounded_conversation(ChatIn(messages=turns)) == [turns[-1]]


@pytest.mark.parametrize("path", ["/chat", "/chat/stream"])
def test_both_routes_bound_history_and_preserve_question(client, monkeypatch, path):
    llm = FakeLLM(reply="A short answer")
    monkeypatch.setattr("routers.chat.get_llm", lambda: llm)
    turns = [{"role": role, "content": "x" * (2000 if role == "user" else 12000)}
             for role in ["user", "assistant"] * 10]
    turns.append({"role": "user", "content": "Where can I get food?"})
    response = client.post(path, json={"messages": turns})
    assert response.status_code == 200
    assert llm.messages == [turns[-1]]
    assert sum(len(t["content"]) for t in llm.messages) <= MAX_HISTORY_CHARS


def test_short_history_is_unchanged():
    turns = [{"role": "user", "content": "Food?"},
             {"role": "assistant", "content": "TCV Food Bank."},
             {"role": "user", "content": "What is the phone number?"}]
    request = ChatIn(messages=turns)
    assert bounded_conversation(request) == turns
    assert request.conversation() == turns
