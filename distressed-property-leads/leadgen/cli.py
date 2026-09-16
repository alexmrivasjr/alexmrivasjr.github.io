from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from .config import load_county_config
from .crossref import cross_reference
from .normalize import normalize_address
from .output import CAVEATS, write_leads_csv, write_manual_followups_csv, write_run_report
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


def run_pipeline(county_key: str, config_dir: str, out_dir: str) -> int:
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

    print(CAVEATS)
    print(f"Wrote {len(leads)} lead(s) and {len(manual_followups)} manual follow-up item(s) to {out}/")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pull, aggregate, and cross-reference distressed-property leads for a county."
    )
    parser.add_argument("--county", required=True, help="County config key, e.g. benton_wa")
    parser.add_argument("--config-dir", default="counties", help="Directory of county YAML configs")
    parser.add_argument("--out", default="out", help="Output directory")
    args = parser.parse_args(argv)
    return run_pipeline(args.county, args.config_dir, args.out)


if __name__ == "__main__":
    sys.exit(main())
