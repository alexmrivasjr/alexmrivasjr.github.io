"""Common data shapes shared across sources, cross-referencing, and output."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Lead:
    """A single normalized record pulled (or hand-entered) from one source."""

    address: str
    owner_name: str
    source_category: str  # tax | recorder | code_enforcement | court | foreclosure
    source_name: str
    county: str
    state: str
    pulled_at: str
    amount: Optional[str] = None
    filing_or_delinquency_date: Optional[str] = None
    record_url: Optional[str] = None
    notes: str = ""
    normalized_address: str = ""
    high_signal: bool = False
    matched_sources: List[str] = field(default_factory=list)

    def as_row(self) -> dict:
        return {
            "address": self.address,
            "owner_name": self.owner_name,
            "source_category": self.source_category,
            "source_name": self.source_name,
            "amount": self.amount or "",
            "filing_or_delinquency_date": self.filing_or_delinquency_date or "",
            "record_url": self.record_url or "",
            "county": self.county,
            "state": self.state,
            "pulled_at": self.pulled_at,
            "high_signal": "yes" if self.high_signal else "no",
            "matched_sources": "; ".join(self.matched_sources),
            "notes": self.notes,
        }


@dataclass
class ManualFollowUp:
    """A source (or part of one) that could not be safely/legally automated."""

    category: str
    county: str
    state: str
    reason: str
    instructions: str
    pulled_at: str
    portal_url: Optional[str] = None
    related_address: Optional[str] = None
    related_owner: Optional[str] = None

    def as_row(self) -> dict:
        return {
            "category": self.category,
            "county": self.county,
            "state": self.state,
            "portal_url": self.portal_url or "",
            "related_address": self.related_address or "",
            "related_owner": self.related_owner or "",
            "reason": self.reason,
            "instructions": self.instructions,
            "pulled_at": self.pulled_at,
        }


@dataclass
class SourceResult:
    leads: List[Lead] = field(default_factory=list)
    manual_followups: List[ManualFollowUp] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
