"""CSV + run-report output. The caveat text here is not decoration -- it is
the difference between a lead-generation tool and a tool that gets someone
to make an offer on a house they don't actually understand. It ships in
every run report, every time, and cannot be suppressed by a CLI flag.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import List

from .models import Lead, ManualFollowUp

CAVEATS = """\
IMPORTANT CAVEATS -- read before contacting anyone about these leads
=====================================================================
1. LEAD GENERATION ONLY. Nothing in this output is verified ownership,
   a clean title, or a confirmed motivated seller. Every address still
   needs a manual title search (and ideally a call to the county
   recorder) before you make any offer or spend any money.
2. DATA LAG. County tax, court, and recorder systems commonly lag real
   -world status by 10-30 days in smaller counties. A "delinquent" or
   "in foreclosure" record here may already be paid off, settled, or
   sold by the time you read this.
3. MANUAL-FOLLOW-UP SOURCES ARE NOT IN THE LEAD LIST. Some public-record
   sources (see manual_followups.csv) have no scrapable public list and
   are not represented in leads.csv at all until you do the manual
   lookup described there.
4. RESPECT SOURCE TERMS. This tool only automates sources that publish a
   directly downloadable list and whose robots.txt allows it. Search
   -only portals (most recorder and court systems) are treated as
   manual-lookup sources on purpose, not scraped around.
"""


def write_leads_csv(leads: List[Lead], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "address", "owner_name", "source_category", "source_name", "amount",
        "filing_or_delinquency_date", "record_url", "county", "state",
        "pulled_at", "high_signal", "matched_sources", "notes",
    ]
    ordered = sorted(leads, key=lambda l: (not l.high_signal, l.address))
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for lead in ordered:
            writer.writerow(lead.as_row())


def write_manual_followups_csv(items: List[ManualFollowUp], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "category", "county", "state", "portal_url", "related_address",
        "related_owner", "reason", "instructions", "pulled_at",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow(item.as_row())


def write_run_report(
    *,
    county: str,
    state: str,
    pulled_at: str,
    leads: List[Lead],
    manual_followups: List[ManualFollowUp],
    source_notes: List[str],
    path: str | Path,
) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    high_signal_count = sum(1 for l in leads if l.high_signal)
    by_category: dict[str, int] = {}
    for l in leads:
        by_category[l.source_category] = by_category.get(l.source_category, 0) + 1
    manual_by_category: dict[str, int] = {}
    for m in manual_followups:
        manual_by_category[m.category] = manual_by_category.get(m.category, 0) + 1

    lines = [
        f"# Lead run report -- {county}, {state}",
        "",
        f"Pulled at: {pulled_at} (UTC)",
        "",
        CAVEATS,
        "## Summary",
        "",
        f"- Total leads pulled automatically: {len(leads)}",
        f"- High-signal leads (2+ sources agree): {high_signal_count}",
        f"- Manual follow-up items: {len(manual_followups)}",
        "",
        "### Leads by source category",
        "",
    ]
    for cat, count in sorted(by_category.items()):
        lines.append(f"- {cat}: {count}")
    lines += ["", "### Manual follow-up needed, by category", ""]
    for cat, count in sorted(manual_by_category.items()):
        lines.append(f"- {cat}: {count} item(s) -- see manual_followups.csv")
    if source_notes:
        lines += ["", "### Notes from this run", ""]
        for note in source_notes:
            lines.append(f"- {note}")
    lines += [
        "",
        "## Files in this run",
        "",
        "- `leads.csv` -- normalized, cross-referenced leads (high-signal first)",
        "- `manual_followups.csv` -- sources/records that need a human to look them up",
        "- `run_report.md` -- this file",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
