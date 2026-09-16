import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.normalize import fuzzy_ratio, normalize_address, normalize_owner


def test_address_variants_collapse_to_same_key():
    a = normalize_address("123 Main St.")
    b = normalize_address("123 MAIN STREET")
    assert a == b


def test_address_unit_stripped_by_default():
    a = normalize_address("456 Elm Ave Apt 4")
    b = normalize_address("456 Elm Avenue")
    assert a == b


def test_address_unit_kept_when_requested():
    a = normalize_address("456 Elm Ave Apt 4", keep_unit=True)
    b = normalize_address("456 Elm Avenue", keep_unit=True)
    assert a != b


def test_directionals_normalized():
    a = normalize_address("100 North Washington Blvd")
    b = normalize_address("100 N Washington Boulevard")
    assert a == b


def test_different_addresses_do_not_collapse():
    assert normalize_address("123 Main St") != normalize_address("456 Elm Ave")


def test_owner_normalization_case_and_punct():
    assert normalize_owner("Smith, John A.") == normalize_owner("SMITH JOHN A")


def test_fuzzy_ratio_identical_is_one():
    assert fuzzy_ratio("123 MAIN ST", "123 MAIN ST") == 1.0


def test_fuzzy_ratio_empty_is_zero():
    assert fuzzy_ratio("", "123 MAIN ST") == 0.0
