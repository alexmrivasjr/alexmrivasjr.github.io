from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List

from ..config import CountyConfig
from ..models import Lead, SourceResult
from ..robots import RobotsChecker


class Source(ABC):
    """One of the pipeline's data sources.

    A source either returns Leads (it found something programmatically
    accessible), ManualFollowUps (it couldn't/shouldn't be automated), or
    both -- e.g. a source that fetches a bulk list fine but also flags a
    per-city gap it can't cover.
    """

    category: str
    name: str

    @abstractmethod
    def run(
        self,
        cfg: CountyConfig,
        robots: RobotsChecker,
        pulled_at: str,
        prior_leads: List[Lead] | None = None,
    ) -> SourceResult:
        ...
