"""Server-side text checks for anything a resident writes.

`scrub_pii` removes contact details people type by accident (or about someone else) before the
text is stored. `needs_review` holds a post back for a human moderator. Both are deliberately
simple pattern checks: they reduce harm, they do not replace moderation.
"""
from __future__ import annotations

import re
import unicodedata

EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
# US phone numbers: (510) 555-0100, 510-555-0100, 510.555.0100, +1 510 555 0100, 5105550100.
PHONE_RE = re.compile(r"(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
SSN_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
STREET_RE = re.compile(
    r"\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}"
    r"(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Parkway|Pkwy|Terrace|Ter|Circle|Cir|Common|Cmn)\b\.?",
    re.I,
)
# Short service numbers are useful in a tip and identify nobody.
SAFE_NUMBERS = ("211", "311", "511", "911", "988")

# A small list: enough to hold obviously abusive posts for review without a third-party service.
BLOCKED_WORDS = (
    "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "pussy", "slut", "whore",
    "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink", "wetback",
    "puta", "puto", "pendejo", "mierda", "cabron", "maricon",
)
LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})
BLOCKED_RE = re.compile(r"(?<![a-z])(?:" + "|".join(BLOCKED_WORDS) + r")(?:s|es|ed|ing|er)?(?![a-z])")
THREAT_RE = re.compile(r"\b(?:kill|shoot|stab|bomb|hurt)\s+(?:you|him|her|them|u)\b", re.I)


def scrub_pii(text: str) -> tuple[str, list[str]]:
    """Returns (text with personal details replaced, the kinds of detail that were removed)."""
    found: list[str] = []

    def replace(pattern: re.Pattern[str], label: str, value: str) -> str:
        def swap(match: re.Match[str]) -> str:
            if label == "phone" and re.sub(r"\D", "", match.group(0)) in SAFE_NUMBERS:
                return match.group(0)
            if label not in found:
                found.append(label)
            return f"[{label} removed]"

        return pattern.sub(swap, value)

    cleaned = replace(EMAIL_RE, "email", text)
    cleaned = replace(SSN_RE, "id number", cleaned)
    cleaned = replace(PHONE_RE, "phone", cleaned)
    cleaned = replace(STREET_RE, "address", cleaned)
    return cleaned, found


def _normalize(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    plain = plain.lower().translate(LEET)
    return re.sub(r"(.)\1{2,}", r"\1", plain)  # "fuuuuck" -> "fuck"


def needs_review(text: str) -> bool:
    """True when the text contains abusive language or a threat and should wait for a moderator."""
    return bool(BLOCKED_RE.search(_normalize(text)) or THREAT_RE.search(text))


def clean_text(text: str) -> str:
    """Collapse whitespace and drop control characters."""
    without_controls = "".join(ch for ch in text if ch == "\n" or unicodedata.category(ch)[0] != "C")
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", without_controls)).strip()
