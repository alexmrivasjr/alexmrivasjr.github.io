from __future__ import annotations

from typing import List

from ..config import CountyConfig
from ..models import Lead, ManualFollowUp, SourceResult
from ..robots import RobotsChecker
from .base import Source

MAX_PER_ADDRESS_FOLLOWUPS = 25


class RecorderSource(Source):
    """County Clerk / Recorder -- liens, deeds, judgments.

    This source's job (per the project brief) is confirmatory: cross-check
    ownership and existing liens on addresses already surfaced by the other
    sources. It runs last in the pipeline, after prior_leads is populated,
    and its job is inherently manual because Aumentum/Fidlar-style recorder
    search portals are grantor/grantee/parcel search forms with no bulk
    export -- automating around that would mean scripting a session-based
    web form, which is exactly the kind of ToS-straddling scraping this
    project avoids.
    """

    category = "recorder"
    name = "County Clerk / Recorder - liens, deeds, judgments"

    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        conf = cfg.source("recorder")
        result = SourceResult()
        if not conf:
            return result

        doc_types = conf.get(
            "doc_types_of_interest",
            ["Notice of Default", "Lis Pendens", "Mechanic's Lien", "Judgment", "Notice of Trustee Sale"],
        )
        base_instructions = conf.get(
            "manual_instructions",
            "Search the recorder's document index by grantor/grantee name and by parcel "
            f"number, filtering document type to: {', '.join(doc_types)}.",
        )
        portal_url = conf.get("portal_url")
        reason = conf.get(
            "reason",
            "The recorder's search system is an interactive grantor/grantee/parcel search "
            "form with no bulk export or public API -- used to confirm leads, not to harvest them.",
        )

        candidates = [l for l in (prior_leads or []) if l.address]
        unique: dict[str, Lead] = {}
        for lead in candidates:
            unique.setdefault(lead.normalized_address or lead.address, lead)

        if not unique:
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category, county=cfg.county, state=cfg.state,
                    reason=reason, portal_url=portal_url, instructions=base_instructions,
                    pulled_at=pulled_at,
                )
            )
            return result

        if len(unique) <= MAX_PER_ADDRESS_FOLLOWUPS:
            for lead in unique.values():
                result.manual_followups.append(
                    ManualFollowUp(
                        category=self.category,
                        county=cfg.county,
                        state=cfg.state,
                        reason=reason,
                        portal_url=portal_url,
                        instructions=f"{base_instructions} This address/owner surfaced via "
                        f"{lead.source_category} -- confirm current ownership and any "
                        "recorded liens before treating it as actionable.",
                        pulled_at=pulled_at,
                        related_address=lead.address,
                        related_owner=lead.owner_name,
                    )
                )
        else:
            result.manual_followups.append(
                ManualFollowUp(
                    category=self.category,
                    county=cfg.county,
                    state=cfg.state,
                    reason=reason,
                    portal_url=portal_url,
                    instructions=f"{base_instructions} {len(unique)} addresses from this run "
                    "need this confirmation step -- see leads.csv (sorted high-signal first) "
                    "and work down the list rather than generating one row per address here.",
                    pulled_at=pulled_at,
                )
            )
        return result
