"""Lightweight address/owner-name normalization for cross-source matching.

This is deliberately not a full USPS-standardization library (no network
lookups, no CASS certification) -- it just needs to be good enough to tell
"123 Main St" and "123 MAIN STREET" apart from "456 Elm Ave" so leads that
show up in more than one source can be matched to each other.
"""
from __future__ import annotations

import re

_STREET_SUFFIXES = {
    "STREET": "ST", "AVENUE": "AVE", "BOULEVARD": "BLVD", "DRIVE": "DR",
    "LANE": "LN", "COURT": "CT", "CIRCLE": "CIR", "PLACE": "PL",
    "ROAD": "RD", "HIGHWAY": "HWY", "PARKWAY": "PKWY", "TERRACE": "TER",
    "TRAIL": "TRL", "SQUARE": "SQ", "LOOP": "LOOP", "WAY": "WAY",
    "CROSSING": "XING", "EXTENSION": "EXT",
}
_DIRECTIONALS = {
    "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W",
    "NORTHEAST": "NE", "NORTHWEST": "NW", "SOUTHEAST": "SE", "SOUTHWEST": "SW",
}
_UNIT_RE = re.compile(r"\b(APT|UNIT|STE|SUITE|#)\s*\.?\s*[\w-]+\b", re.IGNORECASE)
_PUNCT_RE = re.compile(r"[.,]")
_WS_RE = re.compile(r"\s+")

_OWNER_SUFFIX_NOISE = {"THE"}


def _replace_words(text: str, mapping: dict[str, str]) -> str:
    words = text.split()
    return " ".join(mapping.get(w, w) for w in words)


def normalize_address(address: str, *, keep_unit: bool = False) -> str:
    """Return a matching key for an address: upper-case, abbreviated, no punctuation.

    Set keep_unit=True if you need apartment/suite numbers preserved; for
    cross-source matching we usually want them stripped so "123 Main St" and
    "123 Main St Apt 4" still collapse to the same parcel-ish key.
    """
    if not address:
        return ""
    text = address.upper()
    text = _PUNCT_RE.sub("", text)
    if not keep_unit:
        text = _UNIT_RE.sub("", text)
    text = _replace_words(text, _STREET_SUFFIXES)
    text = _replace_words(text, _DIRECTIONALS)
    text = _WS_RE.sub(" ", text).strip()
    return text


def normalize_owner(name: str) -> str:
    if not name:
        return ""
    text = name.upper()
    text = _PUNCT_RE.sub("", text)
    text = _WS_RE.sub(" ", text).strip()
    words = [w for w in text.split() if w not in _OWNER_SUFFIX_NOISE]
    return " ".join(words)


def fuzzy_ratio(a: str, b: str) -> float:
    """0..1 similarity, stdlib-only (difflib) so this has no extra dependency."""
    from difflib import SequenceMatcher

    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()
