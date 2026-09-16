import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.models import Lead
from leadgen.notify_state import (
    compute_new_keys_and_updated_state,
    group_high_signal,
    load_notified,
    new_leads_payload,
    save_notified,
)


def make_lead(address, category, high_signal=True, matched=None, **kw):
    lead = Lead(
        address=address,
        owner_name=kw.pop("owner_name", "Jane Doe"),
        source_category=category,
        source_name=f"{category} source",
        county="Benton County",
        state="WA",
        pulled_at="2026-09-16T00:00:00+00:00",
        **kw,
    )
    lead.normalized_address = address.upper()
    lead.high_signal = high_signal
    lead.matched_sources = matched or []
    return lead


def test_group_high_signal_only_includes_flagged_leads():
    leads = [
        make_lead("123 Main St", "tax", high_signal=True, matched=["tax", "court"]),
        make_lead("456 Elm Ave", "tax", high_signal=False),
    ]
    groups = group_high_signal(leads)
    assert list(groups.keys()) == ["123 MAIN ST"]


def test_load_notified_missing_file_returns_empty():
    assert load_notified("/nonexistent/path.json") == {}


def test_new_keys_detected_and_state_updated(tmp_path):
    leads = [make_lead("123 Main St", "tax", matched=["tax", "court"])]
    groups = group_high_signal(leads)

    new_keys, updated = compute_new_keys_and_updated_state(groups, {}, "2026-09-16T00:00:00+00:00")
    assert new_keys == ["123 MAIN ST"]

    state_path = tmp_path / "notified.json"
    save_notified(state_path, updated)
    reloaded = load_notified(state_path)
    assert reloaded == updated

    # Second run with the same lead: no longer new.
    new_keys_2, _ = compute_new_keys_and_updated_state(groups, reloaded, "2026-09-17T00:00:00+00:00")
    assert new_keys_2 == []


def test_stale_key_dropped_when_no_longer_high_signal():
    old_state = {"999 OLD RD": "2026-01-01T00:00:00+00:00"}
    groups = group_high_signal([make_lead("123 Main St", "tax", matched=["tax", "court"])])
    _, updated = compute_new_keys_and_updated_state(groups, old_state, "2026-09-16T00:00:00+00:00")
    assert "999 OLD RD" not in updated
    assert "123 MAIN ST" in updated


def test_new_leads_payload_shape():
    leads = [
        make_lead("123 Main St", "tax", matched=["tax", "court"], amount="500", record_url="http://x/1"),
        make_lead("123 Main St", "court", matched=["tax", "court"], owner_name="Jane Doe"),
    ]
    groups = group_high_signal(leads)
    payload = new_leads_payload(["123 MAIN ST"], groups, "Benton County", "WA")
    assert len(payload) == 1
    item = payload[0]
    assert item["address"] == "123 Main St"
    assert item["matched_sources"] == ["tax", "court"]
    assert len(item["sources"]) == 2
