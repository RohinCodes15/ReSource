"""Contact-fact check for assistant replies about Fremont.

This check was built when the assistant answered only from ReSource's data: any phone number or
street address in a reply had to appear in that data. The assistant is now general-purpose, so a
reply about, say, a national hotline or a recipe can legitimately contain contact details that are
not in ReSource's data, and rejecting those would throw away good answers.

So the check is scoped down rather than removed. It applies only when the question or the reply
is about Fremont (it names the city, or names a service or organization in ReSource's data). A
wrong local phone number or address is the most harmful kind of mistake for this app, so in that
case a reply with an unlisted number or address is still replaced by the basic search answer.

This is a concrete check on contact facts, not a guarantee that every model claim is correct.
"""
import re

from grounding import load_rows
from moderation import PHONE_RE, STREET_RE
from store import reference

FREMONT_RE = re.compile(r"\bfremont\b", re.IGNORECASE)


def phone_key(value):
    digits = re.sub(r"\D", "", value)
    return digits[1:] if len(digits) == 11 and digits.startswith("1") else digits


def address_key(value):
    value = re.sub(r"[^a-z0-9\s]", "", value.lower())
    value = re.sub(r"\bavenue\b", "ave", value)
    value = re.sub(r"\bstreet\b", "st", value)
    value = re.sub(r"\bboulevard\b", "blvd", value)
    value = re.sub(r"\broad\b", "rd", value)
    value = re.sub(r"\bdrive\b", "dr", value)
    return " ".join(value.split())


def _reference_rows():
    services, resources = load_rows(None, None)
    return [*services, *resources, *reference("council")["members"]]


def contacts_are_grounded(reply):
    """True when every phone number and street address in `reply` appears in ReSource's data."""
    rows = _reference_rows()
    phones = {phone_key(match.group()) for row in rows for match in PHONE_RE.finditer(str(row.get("phone") or ""))}
    addresses = {address_key(match.group()) for row in rows for match in STREET_RE.finditer(str(row.get("address") or ""))}
    return (all(phone_key(match.group()) in phones for match in PHONE_RE.finditer(reply))
            and all(address_key(match.group()) in addresses for match in STREET_RE.finditer(reply)))


def is_fremont_specific(question, reply):
    """The question or reply names Fremont, or the reply names a service or organization we list."""
    if FREMONT_RE.search(question) or FREMONT_RE.search(reply):
        return True
    lowered = reply.lower()
    return any(str(row.get("name") or "").lower() in lowered for row in _reference_rows() if row.get("name"))


def reply_is_acceptable(question, reply):
    """General answers pass; Fremont answers must not carry unlisted phone numbers or addresses."""
    return not is_fremont_specific(question, reply) or contacts_are_grounded(reply)
