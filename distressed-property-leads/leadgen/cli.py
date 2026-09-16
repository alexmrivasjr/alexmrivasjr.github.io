from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .config import load_county_config
from .crossref import cross_reference
from .normalize import normalize_address
from .notify_state import (
    compute_new_keys_and_updated_state,
    group_high_signal,
    load_notified,
    new_leads_payload,
    save_notified,
)
from .output import CAVEATS, write_html_report, write_leads_csv, write_manual_followups_csv, write_run_report
from .robots import RobotsChecker
from .sources.code_enforcement import CodeEnforcementSource
from .sources.court_records import CourtRecordsSource
from .sources.foreclosure_sales import ForeclosureSalesSource
from .sources.recorder_liens import RecorderSource
from .sources.tax_delinquent import TaxDelinquentSource

# Order matters: recorder runs last because its job is to cross-reference
# addresses the other sources already found.
PRIMARY_SOURCES = [
    TaxDelinquentSource(),
    CodeEnforcementSource(),
    CourtRecordsSource(),
    ForeclosureSalesSource(),
]


def run_pipeline(
    county_key: str,
    config_dir: str,
    out_dir: str,
    html_report: str | None = None,
    notified_state: str | None = None,
    new_leads_json: str | None = None,
) -> int:
    cfg = load_county_config(county_key, config_dir)
    robots = RobotsChecker()
    pulled_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    leads = []
    manual_followups = []
    notes = []

    for source in PRIMARY_SOURCES:
        result = source.run(cfg, robots, pulled_at)
        leads.extend(result.leads)
        manual_followups.extend(result.manual_followups)
        notes.extend(result.notes)

    for lead in leads:
        lead.normalized_address = normalize_address(lead.address)
    leads = cross_reference(leads)

    recorder_result = RecorderSource().run(cfg, robots, pulled_at, prior_leads=leads)
    leads.extend(recorder_result.leads)
    manual_followups.extend(recorder_result.manual_followups)
    notes.extend(recorder_result.notes)

    out = Path(out_dir) / county_key
    write_leads_csv(leads, out / "leads.csv")
    write_manual_followups_csv(manual_followups, out / "manual_followups.csv")
    write_run_report(
        county=cfg.county,
        state=cfg.state,
        pulled_at=pulled_at,
        leads=leads,
        manual_followups=manual_followups,
        source_notes=notes,
        path=out / "run_report.md",
    )

    if html_report:
        write_html_report(
            county=cfg.county,
            state=cfg.state,
            pulled_at=pulled_at,
            leads=leads,
            manual_followups=manual_followups,
            path=html_report,
        )

    new_count = 0
    if notified_state:
        groups = group_high_signal(leads)
        notified = load_notified(notified_state)
        new_keys, updated_state = compute_new_keys_and_updated_state(groups, notified, pulled_at)
        save_notified(notified_state, updated_state)
        payload = new_leads_payload(new_keys, groups, cfg.county, cfg.state)
        new_count = len(payload)
        if new_leads_json:
            Path(new_leads_json).parent.mkdir(parents=True, exist_ok=True)
            Path(new_leads_json).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    elif new_leads_json:
        Path(new_leads_json).parent.mkdir(parents=True, exist_ok=True)
        Path(new_leads_json).write_text("[]", encoding="utf-8")

    print(CAVEATS)
    print(f"Wrote {len(leads)} lead(s) and {len(manual_followups)} manual follow-up item(s) to {out}/")
    if notified_state:
        print(f"{new_count} new high-signal lead group(s) since last notified run.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pull, aggregate, and cross-reference distressed-property leads for a county."
    )
    parser.add_argument("--county", required=True, help="County config key, e.g. benton_wa")
    parser.add_argument("--config-dir", default="counties", help="Directory of county YAML configs")
    parser.add_argument("--out", default="out", help="Output directory")
    parser.add_argument(
        "--html-report",
        default=None,
        help="Write a phone-friendly HTML report to this path (e.g. for hosting/linking from a push notification)",
    )
    parser.add_argument(
        "--notified-state",
        default=None,
        help="JSON file tracking previously-notified high-signal lead groups, so repeat runs "
        "only report genuinely new ones",
    )
    parser.add_argument(
        "--new-leads-json",
        default=None,
        help="Write newly-appeared high-signal leads (since --notified-state) to this JSON file",
    )
    args = parser.parse_args(argv)
    return run_pipeline(
        args.county,
        args.config_dir,
        args.out,
        html_report=args.html_report,
        notified_state=args.notified_state,
        new_leads_json=args.new_leads_json,
    )


if __name__ == "__main__":
    sys.exit(main())
