import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.sources.list_fetch import _parse_csv, _remap_rows

ALIASES = {
    "address": ["situs", "property address", "address"],
    "owner_name": ["owner"],
    "amount": ["amount due", "amount"],
}


def test_parse_csv_and_remap_columns():
    content = (
        b"Parcel,Situs Address,Owner,Amount Due\n"
        b"001,123 Main St,Jane Doe,1234.56\n"
        b"002,456 Elm Ave,John Smith,78.90\n"
    )
    raw_rows = _parse_csv(content)
    assert len(raw_rows) == 2
    rows = _remap_rows(raw_rows, ALIASES)
    assert rows[0]["address"] == "123 Main St"
    assert rows[0]["owner_name"] == "Jane Doe"
    assert rows[0]["amount"] == "1234.56"


def test_remap_skips_fully_blank_rows():
    raw_rows = [{"Situs Address": "", "Owner": "", "Amount Due": ""}]
    rows = _remap_rows(raw_rows, ALIASES)
    assert rows == []


def test_remap_missing_column_yields_empty_string_not_error():
    raw_rows = [{"Situs Address": "123 Main St"}]
    rows = _remap_rows(raw_rows, ALIASES)
    assert rows[0]["address"] == "123 Main St"
    assert rows[0]["owner_name"] == ""
