from __future__ import annotations

from typing import List

from ..config import CountyConfig
from ..models import Lead, ManualFollowUp, SourceResult
from ..robots import RobotsChecker
from .base import Source
from .list_fetch import fetch_and_parse_list

DEFAULT_COLUMN_ALIASES = {
    "address": ["address", "location", "site address"],
    "owner_name": ["owner", "respondent"],
    "amount": ["fine", "penalty", "civil penalty", "amount"],
    "filing_date": ["filed", "opened", "violation date", "date"],
}


class CodeEnforcementSource(Source):
    category = "code_enforcement"
    name = "Code Enforcement violations"

    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        conf = cfg.source("code_enforcement")
        result = SourceResult()
        if not conf:
            return result

        list_url = conf.get("public_list_url")
        if list_url and conf.get("automatable", False):
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
                                filing_or_delinquency_date=row.get("filing_date") or None,
                                record_url=list_url,
                            )
                        )
                    result.notes.append(
                        f"Code enforcement: parsed {len(result.leads)} row(s) from {list_url}."
                    )
                    return result
                result.notes.append(f"Code enforcement automated fetch failed: {fetched.error}")
            else:
                result.notes.append(f"Code enforcement automated fetch skipped: {decision.reason}")

        # No public list (the common case) -> manual follow-up, once for the
        # county and once per city that runs its own code enforcement.
        result.manual_followups.append(
            ManualFollowUp(
                category=self.category,
                county=cfg.county,
                state=cfg.state,
                reason=conf.get(
                    "reason",
                    "No published public code-violation list found for the county.",
                ),
                portal_url=conf.get("portal_url"),
                instructions=conf.get(
                    "manual_instructions",
                    "File a Request for Investigation or public records request for any "
                    "address of interest; ask whether there are open violations and whether "
                    "a civil penalty or lien has been imposed.",
                ),
                pulled_at=pulled_at,
            )
        )
        for city in conf.get("also_check_cities", []):
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category,
                    county=cfg.county,
                    state=cfg.state,
                    reason=f"{city.get('name')} runs its own code enforcement, separate from the county.",
                    portal_url=city.get("portal_url"),
                    instructions=city.get("note", "Check this city's code compliance department directly."),
                    pulled_at=pulled_at,
                )
            )
        return result
