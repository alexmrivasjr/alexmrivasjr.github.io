"""Generic "download a published list and turn it into rows" helper.

Shared by any source whose county publishes a direct file -- a delinquent
tax roll, a tax-title/foreclosure list, a sheriff-sale list, etc. -- as a
CSV, XLSX, or PDF with a table in it. Column names vary by county and by
year, so callers pass `column_aliases`: canonical field -> list of
lower-cased substrings to look for in the file's header row.

This never gets clever about a portal that requires clicking through a
search form or accepting a session cookie -- that's out of scope for a
"list fetch" and belongs in a manual-follow-up instead.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

import requests

FETCH_TIMEOUT_SECONDS = 30
USER_AGENT = "DistressedPropertyLeadBot/1.0 (+personal research tool)"


@dataclass
class FetchedRows:
    rows: list[dict[str, Any]]
    error: str | None = None


def _match_column(header: list[str], aliases: list[str]) -> str | None:
    lower = [str(h).strip().lower() for h in header]
    for alias in aliases:
        for i, h in enumerate(lower):
            if alias in h:
                return header[i]
    return None


def _remap_rows(raw_rows: list[dict[str, Any]], column_aliases: dict[str, list[str]]) -> list[dict[str, Any]]:
    if not raw_rows:
        return []
    header = list(raw_rows[0].keys())
    mapping = {field: _match_column(header, aliases) for field, aliases in column_aliases.items()}
    out = []
    for raw in raw_rows:
        row = {field: (raw.get(col, "") if col else "") for field, col in mapping.items()}
        if any(str(v).strip() for v in row.values()):
            out.append(row)
    return out


def fetch_and_parse_list(
    url: str,
    fmt: str,
    column_aliases: dict[str, list[str]],
) -> FetchedRows:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=FETCH_TIMEOUT_SECONDS)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as a manual-followup reason
        return FetchedRows(rows=[], error=f"Fetch failed for {url}: {exc}")

    fmt = fmt.lower()
    try:
        if fmt == "csv":
            raw_rows = _parse_csv(resp.content)
        elif fmt in ("xlsx", "xls"):
            raw_rows = _parse_excel(resp.content)
        elif fmt == "pdf":
            raw_rows = _parse_pdf(resp.content)
        else:
            return FetchedRows(rows=[], error=f"Unsupported list_format: {fmt!r}")
    except Exception as exc:  # noqa: BLE001
        return FetchedRows(rows=[], error=f"Parsing failed for {url} as {fmt}: {exc}")

    rows = _remap_rows(raw_rows, column_aliases)
    if not rows:
        return FetchedRows(rows=[], error=f"Downloaded {url} but found no parseable rows.")
    return FetchedRows(rows=rows)


def _parse_csv(content: bytes) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
    return df.to_dict(orient="records")


def _parse_excel(content: bytes) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.read_excel(io.BytesIO(content), dtype=str)
    df = df.fillna("")
    return df.to_dict(orient="records")


def _parse_pdf(content: bytes) -> list[dict[str, Any]]:
    import pdfplumber

    rows: list[dict[str, Any]] = []
    header: list[str] | None = None
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for i, raw_row in enumerate(table):
                cleaned = [(c or "").strip() for c in raw_row]
                if header is None:
                    header = cleaned
                    continue
                if cleaned == header:
                    continue  # repeated header row on later pages
                rows.append(dict(zip(header, cleaned)))
    return rows
