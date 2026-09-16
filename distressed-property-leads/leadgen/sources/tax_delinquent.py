from __future__ import annotations

from typing import List

from ..config import CountyConfig
from ..models import Lead, ManualFollowUp, SourceResult
from ..robots import RobotsChecker
from .base import Source
from .list_fetch import fetch_and_parse_list

DEFAULT_COLUMN_ALIASES = {
    "address": ["situs", "property address", "site address", "address"],
    "owner_name": ["owner", "taxpayer", "grantee"],
    "amount": ["amount", "total due", "balance", "taxes due", "amount owed"],
    "delinquency_date": ["delinquent since", "delinquent date", "tax year", "date delinquent"],
    "parcel_number": ["parcel", "pin", "tax id", "account"],
}


class TaxDelinquentSource(Source):
    category = "tax"
    name = "County Tax Office - delinquent/foreclosure/tax-title list"

    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        conf = cfg.source("tax_delinquent")
        result = SourceResult()
        if not conf:
            return result

        portal_url = conf.get("portal_url")
        list_url = conf.get("list_url")
        automatable = conf.get("automatable", False)

        if not automatable or not list_url:
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category,
                    county=cfg.county,
                    state=cfg.state,
                    reason=conf.get(
                        "reason",
                        "No direct downloadable delinquent/foreclosure list URL is configured yet.",
                    ),
                    portal_url=portal_url,
                    instructions=conf.get(
                        "manual_instructions",
                        f"Visit {portal_url} and look for the current year's delinquent tax, "
                        "tax-foreclosure, or tax-title parcel list (often a PDF published "
                        "seasonally). Once you find a direct file URL, set sources.tax_delinquent"
                        ".list_url and .list_format in this county's config to automate it.",
                    ),
                    pulled_at=pulled_at,
                )
            )
            return result

        decision = robots.check(list_url)
        if not decision.allowed:
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category,
                    county=cfg.county,
                    state=cfg.state,
                    reason=f"robots.txt check failed: {decision.reason}",
                    portal_url=portal_url or list_url,
                    instructions=f"Download the list manually from {list_url}.",
                    pulled_at=pulled_at,
                )
            )
            return result

        aliases = {**DEFAULT_COLUMN_ALIASES, **conf.get("column_aliases", {})}
        fetched = fetch_and_parse_list(list_url, conf.get("list_format", "csv"), aliases)
        if fetched.error:
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category,
                    county=cfg.county,
                    state=cfg.state,
                    reason=fetched.error,
                    portal_url=portal_url or list_url,
                    instructions=f"Automated fetch/parse failed -- open {list_url} manually and "
                    "extract address, owner, amount owed, and delinquency date by hand.",
                    pulled_at=pulled_at,
                )
            )
            return result

        for row in fetched.rows:
            result.leads.append(
                Lead(
                    address=row.get("address", ""),
                    owner_name=row.get("owner_name", ""),
                    source_category=self.category,
                    source_name=self.name,
                    county=cfg.county,
                    state=cfg.state,
                    pulled_at=pulled_at,
                    amount=row.get("amount") or None,
                    filing_or_delinquency_date=row.get("delinquency_date") or None,
                    record_url=list_url,
                    notes=f"parcel {row.get('parcel_number')}".strip() if row.get("parcel_number") else "",
                )
            )
        result.notes.append(f"Tax delinquent list: parsed {len(result.leads)} row(s) from {list_url}.")
        return result
