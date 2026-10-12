import logging
import re
from typing import Optional

from config import FREMONT_CENTER, OPENAI_API_KEY, OPENAI_MODEL
from data import get_services, nearby_resources
from schemas import ChatIn, ChatOut

log = logging.getLogger("resource.chat")

SYSTEM_PROMPT = """You are ReSource, a friendly assistant for residents of Fremont, CA during the \
city's budget crisis. Help people understand which city services are being cut and find free or \
low-cost alternatives nearby. Use ONLY the facts in the context below; if something isn't there, \
say you don't know and suggest calling the city. Keep answers short, plain-language, and include \
phone numbers and hours when recommending a resource."""


def _format_resources(items: list[dict]) -> str:
    return "\n".join(
        f"- {r['name']} ({r['category']}, {r['distance_miles']} mi): {r['description']} "
        f"Hours: {r['hours']}. Phone: {r['phone']}. Address: {r['address']}"
        for r in items
    )


def _format_services() -> str:
    return "\n".join(
        f"- {s['name']}: {s['change']} ({s['effective']}). {s['details']}" for s in get_services()
    )


def build_context(req: ChatIn) -> str:
    near = nearby_resources(req.latitude, req.longitude, limit=8)
    where = "the user's location" if req.latitude is not None else "Fremont City Hall"
    return (
        f"City services being cut:\n{_format_services()}\n\n"
        f"Alternative resources nearest {where}:\n{_format_resources(near)}"
    )


def fallback_reply(req: ChatIn) -> str:
    """Keyword answers from the shared data, used when no OpenAI key is configured."""
    q = req.message.lower()
    where = "near you" if req.latitude is not None else "near central Fremont"

    def top(category: Optional[str], n: int = 3) -> str:
        return _format_resources(nearby_resources(req.latitude, req.longitude, category, limit=n))

    if re.search(r"food|hungry|lunch|meal|grocer|pantry", q):
        return f"Free food options {where}:\n{top('Food')}"
    if re.search(r"clinic|doctor|health|flu|medical|vaccin", q):
        return f"Free or low-cost health care {where}:\n{top('Health')}"
    for s in get_services():
        keywords = [s["category"]] + [w for w in re.split(r"\W+", s["name"].lower()) if len(w) > 4]
        if any(k in q for k in keywords):
            return (
                f"{s['name']}: {s['change']}. {s['effective']}. {s['details']}\n\n"
                f"Alternatives {where}:\n{top(None, 2)}"
            )
    if re.search(r"open|near me|nearby|still|available", q):
        cuts = "; ".join(f"{s['name']} ({s['effective'].lower()})" for s in get_services())
        return f"Closest resources that are still open {where}:\n{top(None, 4)}\n\nCity services being cut: {cuts}."
    if re.search(r"council|vote|rep|mayor|contact", q):
        return "Open the Reps tab to see how each council member voted on the budget and to call or email them."
    return (
        "I can help you find free food, clinics and other resources, and explain which city services "
        'are being cut. Try: "What services are still open near me?"'
    )


async def answer(req: ChatIn) -> ChatOut:
    if OPENAI_API_KEY:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            messages = [{"role": "system", "content": f"{SYSTEM_PROMPT}\n\n{build_context(req)}"}]
            messages += [{"role": t.role, "content": t.content} for t in req.history[-10:]]
            messages.append({"role": "user", "content": req.message})
            resp = await client.chat.completions.create(model=OPENAI_MODEL, messages=messages, temperature=0.3)
            reply = resp.choices[0].message.content
            if reply:
                return ChatOut(reply=reply.strip(), source="openai")
        except Exception:
            log.exception("OpenAI request failed; using fallback reply")
    return ChatOut(reply=fallback_reply(req), source="fallback")
