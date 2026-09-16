from __future__ import annotations

from typing import List

from ..config import CountyConfig
from ..models import Lead, ManualFollowUp, SourceResult
from ..robots import RobotsChecker
from .base import Source


class CourtRecordsSource(Source):
    category = "court"
    name = "District Clerk / Court Records (probate, divorce, foreclosure)"

    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        conf = cfg.source("court_records")
        result = SourceResult()
        if not conf:
            return result

        # Case-lookup portals are almost universally session/CAPTCHA-gated
        # search forms with no bulk export, and many states' complete court
        # data requires a paid subscription (e.g. Washington's JIS-Link)
        # whose terms restrict automated/bulk use. We only ever attempt a
        # bulk pull here if a county config explicitly marks a specific
        # endpoint automatable; otherwise this is manual by design, not by
        # omission.
        if conf.get("automatable", False) and conf.get("list_url"):
            decision = robots.check(conf["list_url"])
            if not decision.allowed:
                result.notes.append(f"Court records automated fetch skipped: {decision.reason}")
            else:
                result.notes.append(
                    "This county config marks court_records automatable, but no generic "
                    "case-search parser is implemented (case-search result formats vary too "
                    "much to generalize safely). Falling back to manual follow-up."
                )

        case_types = conf.get("case_types_of_interest", ["Probate", "Divorce", "Foreclosure"])
        result.manual_followups.append(
            ManualFollowUp(
                category=self.category,
                county=cfg.county,
                state=cfg.state,
                reason=conf.get(
                    "reason",
                    "Case-lookup portals require an interactive search (and often a paid "
                    "subscription for full/bulk access); no scrapable public bulk list exists.",
                ),
                portal_url=conf.get("portal_url"),
                instructions=conf.get(
                    "manual_instructions",
                    "Search the county's case-lookup portal filtered to case types: "
                    f"{', '.join(case_types)}. For each hit, record case number, filing date, "
                    "parties, and property address if listed, then cross-reference the address "
                    "against the recorder and tax sources.",
                ),
                pulled_at=pulled_at,
            )
        )
        return result
