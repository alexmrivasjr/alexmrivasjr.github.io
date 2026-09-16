import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.crossref import cross_reference
from leadgen.models import Lead


def make_lead(address, owner, category, **kw):
    return Lead(
        address=address,
        owner_name=owner,
        source_category=category,
        source_name=f"{category} source",
        county="Benton County",
        state="WA",
        pulled_at="2026-09-16T00:00:00+00:00",
        **kw,
    )


def test_same_address_two_categories_is_high_signal():
    leads = [
        make_lead("123 Main St", "Jane Doe", "tax"),
        make_lead("123 Main St", "Jane Doe", "code_enforcement"),
    ]
    result = cross_reference(leads)
    assert all(l.high_signal for l in result)
    assert set(result[0].matched_sources) == {"tax", "code_enforcement"}


def test_single_source_address_not_high_signal():
    leads = [make_lead("123 Main St", "Jane Doe", "tax")]
    result = cross_reference(leads)
    assert result[0].high_signal is False
    assert result[0].matched_sources == []


def test_different_addresses_same_category_not_flagged():
    leads = [
        make_lead("123 Main St", "Jane Doe", "tax"),
        make_lead("456 Elm Ave", "John Smith", "tax"),
    ]
    result = cross_reference(leads)
    assert all(not l.high_signal for l in result)


def test_near_duplicate_address_spelling_still_matches():
    leads = [
        make_lead("123 Main St.", "Jane Doe", "tax"),
        make_lead("123 MAIN STREET", "Jane Doe", "court"),
    ]
    result = cross_reference(leads)
    assert all(l.high_signal for l in result)


def test_same_owner_different_address_flags_weaker_signal():
    leads = [
        make_lead("123 Main St", "Jane Q Doe", "tax"),
        make_lead("999 Other Rd", "Jane Q Doe", "court"),
    ]
    result = cross_reference(leads)
    assert result[0].high_signal or result[1].high_signal
