from __future__ import annotations

from typing import List

from ..config import CountyConfig
from ..models import Lead, ManualFollowUp, SourceResult
from ..robots import RobotsChecker
from .base import Source
from .list_fetch import fetch_and_parse_list

DEFAULT_COLUMN_ALIASES = {
    "address": ["address", "property address", "situs"],
    "owner_name": ["owner", "grantor", "borrower", "defendant"],
    "amount": ["opening bid", "amount", "judgment amount"],
    "sale_date": ["sale date", "auction date", "date"],
}


class ForeclosureSalesSource(Source):
    """Auction-stage foreclosure listings: sheriff sale or trustee sale.

    Pre-foreclosure (notice of default / lis pendens) is covered by the
    recorder source, since that's where those filings actually live. This
    source is specifically the auction stage. Judicial-foreclosure states
    often have a county sheriff sale list (sometimes a real downloadable
    list -- automate it the same way as the tax list); non-judicial /
    deed-of-trust states (like Washington) don't have a single county-run
    auction list at all, so this degrades to pointing back at the recorder's
    "Notice of Trustee Sale" document-type filter.
    """

    category = "foreclosure"
    name = "Sheriff/Trustee sale (auction-stage foreclosure) listings"

    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        conf = cfg.source("foreclosure_sales")
        result = SourceResult()
        if not conf:
            return result

        list_url = conf.get("list_url")
        if conf.get("automatable", False) and list_url:
            decision = robots.check(list_url)
            if decision.allowed:
                aliases = {**DEFAULT_COLUMN_ALIASES, **conf.get("column_aliases", {})}
                fetched = fetch_and_parse_list(list_url, conf.get("list_format", "csv"), aliases)
                if not fetched.error:
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
                                filing_or_delinquency_date=row.get("sale_date") or None,
                                record_url=list_url,
                            )
                        )
                    result.notes.append(f"Foreclosure sales: parsed {len(result.leads)} row(s) from {list_url}.")
                    return result
                result.manual_followups.append(
                    ManualFollowUp(
                        category=self.category, county=cfg.county, state=cfg.state,
                        reason=fetched.error, portal_url=list_url,
                        instructions=f"Open {list_url} manually and extract sale listings by hand.",
                        pulled_at=pulled_at,
                    )
                )
                return result
            result.notes.append(f"Foreclosure sales automated fetch skipped: {decision.reason}")

        result.manual_followups.append(
            ManualFollowUp(
                category=self.category,
                county=cfg.county,
                state=cfg.state,
                reason=conf.get(
                    "reason",
                    "No single county-run public auction-listing page/list is configured.",
                ),
                portal_url=conf.get("portal_url"),
                instructions=conf.get(
                    "manual_instructions",
                    "Use the recorder source's document-type filter for 'Notice of Trustee "
                    "Sale' (non-judicial states) or check the sheriff/court's own sale-list "
                    "page (judicial states) for upcoming auctions.",
                ),
                pulled_at=pulled_at,
            )
        )
        return result
