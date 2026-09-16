"""Tracks which high-signal lead groups have already been notified about,
so a scheduled run only pushes a phone notification for genuinely new
leads -- mirroring the soil-tracker's data/notified.json pattern (see
scripts/scrape.js at the repo root) rather than re-alerting on every run
for a lead that's still sitting there from last time.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from .models import Lead


def group_high_signal(leads: Iterable[Lead]) -> Dict[str, List[Lead]]:
    groups: Dict[str, List[Lead]] = {}
    for lead in leads:
        if lead.high_signal and lead.normalized_address:
            groups.setdefault(lead.normalized_address, []).append(lead)
    return groups


def load_notified(path: str | Path) -> Dict[str, str]:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def compute_new_keys_and_updated_state(
    groups: Dict[str, List[Lead]],
    notified: Dict[str, str],
    pulled_at: str,
) -> Tuple[List[str], Dict[str, str]]:
    new_keys = [key for key in groups if key not in notified]
    updated = {key: notified.get(key, pulled_at) for key in groups}
    return new_keys, updated


def save_notified(path: str | Path, state: Dict[str, str]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def new_leads_payload(new_keys: List[str], groups: Dict[str, List[Lead]], county: str, state: str) -> list[dict]:
    payload = []
    for key in new_keys:
        group = groups[key]
        first = group[0]
        payload.append(
            {
                "address": first.address,
                "owner_names": sorted({l.owner_name for l in group if l.owner_name}),
                "matched_sources": first.matched_sources,
                "county": county,
                "state": state,
                "sources": [
                    {
                        "source_category": l.source_category,
                        "source_name": l.source_name,
                        "amount": l.amount,
                        "filing_or_delinquency_date": l.filing_or_delinquency_date,
                        "record_url": l.record_url,
                    }
                    for l in group
                ],
            }
        )
    return payload
