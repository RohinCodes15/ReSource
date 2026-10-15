"""Reject model replies containing phone numbers or street addresses absent from references.

This is a concrete check on contact facts, not a guarantee that every model claim is correct.
"""
import re

from grounding import load_rows
from moderation import PHONE_RE, STREET_RE
from store import reference


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


def contacts_are_grounded(reply):
    services, resources = load_rows(None, None)
    rows = [*services, *resources, *reference("council")["members"]]
    phones = {phone_key(match.group()) for row in rows for match in PHONE_RE.finditer(str(row.get("phone") or ""))}
    addresses = {address_key(match.group()) for row in rows for match in STREET_RE.finditer(str(row.get("address") or ""))}
    return (all(phone_key(match.group()) in phones for match in PHONE_RE.finditer(reply))
            and all(address_key(match.group()) in addresses for match in STREET_RE.finditer(reply)))
