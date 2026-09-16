"""Cross-source flagging: an address (or owner) that shows up under more than
one source category -- e.g. tax-delinquent AND a recorded lien, or probate
AND tax-delinquent -- is a stronger candidate for a motivated seller.

This does an exact match on the normalized address first (cheap, precise),
then a bounded fuzzy pass to catch near-duplicate spellings of the same
address across sources that format things slightly differently. The fuzzy
pass is O(n^2) over distinct address keys, so it's skipped (with a note)
above FUZZY_MATCH_MAX_KEYS -- exact matching still runs regardless.
"""
from __future__ import annotations

from collections import defaultdict
from typing import List

from .models import Lead
from .normalize import fuzzy_ratio, normalize_owner

FUZZY_MATCH_MAX_KEYS = 3000
ADDRESS_FUZZY_THRESHOLD = 0.93
OWNER_FUZZY_THRESHOLD = 0.90


class _UnionFind:
    def __init__(self, keys):
        self.parent = {k: k for k in keys}

    def find(self, k):
        while self.parent[k] != k:
            self.parent[k] = self.parent[self.parent[k]]
            k = self.parent[k]
        return k

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def cross_reference(leads: List[Lead]) -> List[Lead]:
    for lead in leads:
        if not lead.normalized_address:
            from .normalize import normalize_address

            lead.normalized_address = normalize_address(lead.address)

    keys = sorted({l.normalized_address for l in leads if l.normalized_address})
    uf = _UnionFind(keys)

    if len(keys) <= FUZZY_MATCH_MAX_KEYS:
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                if fuzzy_ratio(keys[i], keys[j]) >= ADDRESS_FUZZY_THRESHOLD:
                    uf.union(keys[i], keys[j])

    groups: dict[str, list[Lead]] = defaultdict(list)
    for lead in leads:
        if lead.normalized_address:
            groups[uf.find(lead.normalized_address)].append(lead)

    for group in groups.values():
        categories = sorted({l.source_category for l in group})
        if len(categories) > 1:
            for l in group:
                l.high_signal = True
                l.matched_sources = categories

    # Secondary, weaker signal: same owner name (fuzzy) across categories,
    # even at a different address (e.g. an absentee owner with a tax-delinquent
    # rental and a separate probate filing). Only upgrades leads that aren't
    # already flagged by the address match above.
    owner_leads = [l for l in leads if l.owner_name]
    for i, l1 in enumerate(owner_leads):
        if l1.high_signal:
            continue
        o1 = normalize_owner(l1.owner_name)
        for l2 in owner_leads:
            if l2 is l1 or l2.source_category == l1.source_category:
                continue
            o2 = normalize_owner(l2.owner_name)
            if fuzzy_ratio(o1, o2) >= OWNER_FUZZY_THRESHOLD:
                l1.high_signal = True
                l1.matched_sources = sorted(set(l1.matched_sources) | {l1.source_category, l2.source_category})
                break

    return leads
