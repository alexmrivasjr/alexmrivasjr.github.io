"""Every county config under counties/*.yaml (except the _template) should
load and run through the full pipeline without raising -- this is what
would have caught a typo'd key in a new county file before it shipped.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.config import load_county_config
from leadgen.crossref import cross_reference
from leadgen.normalize import normalize_address
from leadgen.robots import RobotsChecker
from leadgen.sources.code_enforcement import CodeEnforcementSource
from leadgen.sources.court_records import CourtRecordsSource
from leadgen.sources.foreclosure_sales import ForeclosureSalesSource
from leadgen.sources.recorder_liens import RecorderSource
from leadgen.sources.tax_delinquent import TaxDelinquentSource

COUNTIES_DIR = Path(__file__).resolve().parents[1] / "counties"
COUNTY_KEYS = sorted(
    p.stem for p in COUNTIES_DIR.glob("*.yaml") if not p.stem.startswith("_")
)


@pytest.mark.parametrize("county_key", COUNTY_KEYS)
def test_county_config_runs_end_to_end(county_key):
    cfg = load_county_config(county_key, COUNTIES_DIR)
    robots = RobotsChecker()
    pulled_at = "2026-09-16T00:00:00+00:00"

    leads = []
    manual_followups = []
    for source in [
        TaxDelinquentSource(),
        CodeEnforcementSource(),
        CourtRecordsSource(),
        ForeclosureSalesSource(),
    ]:
        result = source.run(cfg, robots, pulled_at)
        leads.extend(result.leads)
        manual_followups.extend(result.manual_followups)

    for lead in leads:
        lead.normalized_address = normalize_address(lead.address)
    leads = cross_reference(leads)

    recorder_result = RecorderSource().run(cfg, robots, pulled_at, prior_leads=leads)
    manual_followups.extend(recorder_result.manual_followups)

    # Every source that isn't automatable must explain itself, not fail silently.
    assert len(manual_followups) > 0
    for item in manual_followups:
        assert item.reason
        assert item.instructions


def test_at_least_one_county_config_exists():
    assert COUNTY_KEYS, "expected at least one counties/*.yaml besides _template.yaml"
