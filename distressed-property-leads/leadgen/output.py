"""CSV + run-report output. The caveat text here is not decoration -- it is
the difference between a lead-generation tool and a tool that gets someone
to make an offer on a house they don't actually understand. It ships in
every run report, every time, and cannot be suppressed by a CLI flag.
"""
from __future__ import annotations

import csv
from html import escape
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


def _lead_row_html(lead: Lead) -> str:
    return f"""<tr>
  <td>{escape(lead.source_category)}</td>
  <td>{escape(lead.amount or "—")}</td>
  <td>{escape(lead.filing_or_delinquency_date or "—")}</td>
  <td>{f'<a href="{escape(lead.record_url)}">record</a>' if lead.record_url else "—"}</td>
</tr>"""


def _high_signal_card_html(group: List[Lead]) -> str:
    display_address = group[0].address
    owners = sorted({l.owner_name for l in group if l.owner_name})
    matched = group[0].matched_sources
    badges = "".join(f'<span class="badge">{escape(s)}</span>' for s in matched)
    rows = "\n".join(_lead_row_html(l) for l in group)
    return f"""<div class="card high-signal">
  <h3>{escape(display_address)}</h3>
  <p class="owners">{escape(", ".join(owners)) or "Owner name not captured"}</p>
  <div class="badges">{badges}</div>
  <table>
    <thead><tr><th>Source</th><th>Amount</th><th>Date</th><th>Record</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""


def _other_lead_row_html(lead: Lead) -> str:
    link = f'<a href="{escape(lead.record_url)}">record</a>' if lead.record_url else "—"
    return f"""<tr>
  <td>{escape(lead.address)}</td>
  <td>{escape(lead.owner_name or "—")}</td>
  <td>{escape(lead.source_category)}</td>
  <td>{escape(lead.amount or "—")}</td>
  <td>{escape(lead.filing_or_delinquency_date or "—")}</td>
  <td>{link}</td>
</tr>"""


def _manual_followup_row_html(item: ManualFollowUp) -> str:
    link = f'<a href="{escape(item.portal_url)}">portal</a>' if item.portal_url else "—"
    related = escape(item.related_address or "—")
    return f"""<tr>
  <td>{escape(item.category)}</td>
  <td>{related}</td>
  <td>{escape(item.reason)}</td>
  <td>{escape(item.instructions)}</td>
  <td>{link}</td>
</tr>"""


_HTML_STYLE = """\
:root { color-scheme: light dark; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 760px; margin: 0 auto; padding: 16px;
  background: #ffffff; color: #1a1a1a; line-height: 1.45;
}
@media (prefers-color-scheme: dark) {
  body { background: #121212; color: #eaeaea; }
  .card, table { background: #1c1c1c !important; }
  th { background: #262626 !important; }
  a { color: #7cb7ff !important; }
  .caveats { background: #332900 !important; border-color: #6b5900 !important; }
}
h1 { font-size: 1.3rem; }
h2 { font-size: 1.1rem; margin-top: 2rem; }
h3 { font-size: 1rem; margin: 0 0 4px; }
.meta { color: #666; font-size: 0.85rem; }
.caveats {
  background: #fff8e1; border: 1px solid #e0c46b; border-radius: 8px;
  padding: 12px 16px; font-size: 0.85rem; margin: 16px 0;
}
.caveats ol { margin: 4px 0 0; padding-left: 1.2rem; }
.card {
  background: #f7f7f7; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;
}
.card.high-signal { border-left: 4px solid #d9822b; }
.owners { margin: 2px 0 8px; font-size: 0.9rem; color: #555; }
.badges { margin-bottom: 8px; }
.badge {
  display: inline-block; font-size: 0.75rem; background: #d9822b; color: #fff;
  border-radius: 999px; padding: 2px 10px; margin-right: 4px;
}
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
th { background: #f0f0f0; }
.empty { color: #777; font-style: italic; }
"""


def write_html_report(
    *,
    county: str,
    state: str,
    pulled_at: str,
    leads: List[Lead],
    manual_followups: List[ManualFollowUp],
    path: str | Path,
) -> None:
    """A phone-friendly HTML page meant to be pushed/linked to, not just
    stored locally -- this is what a push notification's "tap to view" opens.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    high_signal_groups: dict[str, List[Lead]] = {}
    other_leads: List[Lead] = []
    for lead in leads:
        if lead.high_signal and lead.normalized_address:
            high_signal_groups.setdefault(lead.normalized_address, []).append(lead)
        else:
            other_leads.append(lead)

    high_signal_html = (
        "\n".join(_high_signal_card_html(grp) for grp in high_signal_groups.values())
        if high_signal_groups
        else '<p class="empty">None this run.</p>'
    )
    other_leads_html = (
        f"""<table>
  <thead><tr><th>Address</th><th>Owner</th><th>Source</th><th>Amount</th><th>Date</th><th>Record</th></tr></thead>
  <tbody>{"".join(_other_lead_row_html(l) for l in other_leads)}</tbody>
</table>"""
        if other_leads
        else '<p class="empty">None this run.</p>'
    )
    manual_html = (
        f"""<table>
  <thead><tr><th>Category</th><th>Related to</th><th>Reason</th><th>What to do</th><th>Portal</th></tr></thead>
  <tbody>{"".join(_manual_followup_row_html(m) for m in manual_followups)}</tbody>
</table>"""
        if manual_followups
        else '<p class="empty">None this run.</p>'
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leads report -- {escape(county)}, {escape(state)}</title>
<style>{_HTML_STYLE}</style>
</head>
<body>
<h1>Distressed-property leads -- {escape(county)}, {escape(state)}</h1>
<p class="meta">Pulled at {escape(pulled_at)} (UTC)</p>

<div class="caveats">
  <strong>Read before contacting anyone about these leads:</strong>
  <ol>
    <li>Lead generation only -- not verified ownership or a clean title. Do a manual title search before any offer.</li>
    <li>County data can lag real-world status by 10-30 days in smaller counties.</li>
    <li>Sources with no scrapable public list aren't in this report at all until you do the manual lookup below.</li>
  </ol>
</div>

<h2>High-signal leads ({len(high_signal_groups)})</h2>
{high_signal_html}

<h2>Other leads ({len(other_leads)})</h2>
{other_leads_html}

<h2>Manual follow-up needed ({len(manual_followups)})</h2>
{manual_html}

</body>
</html>
"""
    path.write_text(html, encoding="utf-8")
