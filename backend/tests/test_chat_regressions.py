"""B1/B2 regressions: every locale's chips and long assistant history."""
import json
from pathlib import Path

import pytest
from test_chat import FakeLLM

from grounding import local_answer
from schemas import MAX_ANSWER_CHARS, ChatTurn

LOCALES = Path(__file__).resolve().parents[2] / "app" / "src" / "locales"
LOCALE_FILES = sorted(LOCALES.glob("*.json"))


def expected_source(locale, chip):
    if chip == "s1":
        return "Street pavement maintenance"
    return {"s2": "TCV Food Bank + Mobile Pantry",
            "s3": "Bay Area Community Health: Liberty Clinic",
            "s4": "Mayor & City Council (City of Fremont)"}[chip]


@pytest.mark.parametrize("locale_file", LOCALE_FILES, ids=lambda path: path.stem)
def test_suggestion_chips_for_every_locale(client, locale_file):
    english = json.loads((LOCALES / "en.json").read_text())["chat"]
    translated = json.loads(locale_file.read_text())["chat"]
    for key in ("s1", "s2", "s3", "s4"):
        # Same English fallback as the frontend for missing translations.
        question = translated.get(key, english[key])
        response = client.post("/chat", json={
            "language": locale_file.stem,
            "messages": [{"role": "user", "content": question}],
        })
        assert response.status_code == 200, (locale_file.stem, key)
        answer = response.json()
        assert answer["mode"] == "basic"
        assert expected_source(locale_file.stem, key) in answer["sources"], (locale_file.stem, key, answer)
        if key == "s1":
            assert "Abode Services" not in answer["sources"]


@pytest.mark.parametrize("question", ["Which services were cut?", "What city services were reduced?",
                                     "Tell me about center services", "Bay area services"])
def test_generic_name_words_do_not_select_abode(client, question):
    sources = local_answer(question, "en", None, None)[1]
    assert "Street pavement maintenance" in sources
    assert "Abode Services" not in sources


def test_distinctive_resource_names_still_match(client):
    assert local_answer("Tell me about Abode", "en", None, None)[1] == ["Abode Services"]
    assert local_answer("What help does TCV offer?", "en", None, None)[1] == ["TCV Food Bank + Mobile Pantry"]


@pytest.mark.parametrize("length", [2001, 6000, MAX_ANSWER_CHARS, MAX_ANSWER_CHARS + 1, 20000])
def test_assistant_turns_are_accepted_and_bounded(length):
    turn = ChatTurn(role="assistant", content="a" * length)
    assert len(turn.content) == min(length, MAX_ANSWER_CHARS)
    with pytest.raises(ValueError):
        ChatTurn(role="user", content="u" * 2001)


@pytest.mark.parametrize("path", ["/chat", "/chat/stream"])
@pytest.mark.parametrize("length", [2001, 6000, 20000])
def test_followup_after_long_answer_reaches_model(client, monkeypatch, path, length):
    llm = FakeLLM(reply="Here is more help.")
    monkeypatch.setattr("routers.chat.get_llm", lambda: llm)
    turns = [{"role": "user", "content": "Where can I get food?"},
             {"role": "assistant", "content": "a" * length},
             {"role": "user", "content": "What is the phone number?"}]
    response = client.post(path, json={"messages": turns})
    assert response.status_code == 200
    assert llm.messages[-1] == turns[-1]
    assert llm.messages[0]["role"] == "user"
    # Unsigned client history is accepted for compatibility but never forwarded to the model.
    assert llm.messages == [turns[-1]]
