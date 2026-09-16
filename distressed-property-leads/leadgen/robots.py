"""robots.txt compliance gate.

Every automated fetch in this project goes through RobotsChecker.allowed()
first. The policy is deliberately fail-closed: if robots.txt can't be read
at all (network error, timeout), we treat the URL as NOT allowed rather than
assuming permission, and the caller falls back to a manual-follow-up entry
instead of scraping blind.
"""
from __future__ import annotations

import urllib.robotparser as robotparser
from dataclasses import dataclass
from urllib.parse import urlparse

USER_AGENT = "DistressedPropertyLeadBot/1.0 (+personal research tool; contact via repo owner)"


@dataclass
class RobotsDecision:
    allowed: bool
    reason: str


class RobotsChecker:
    def __init__(self, user_agent: str = USER_AGENT):
        self.user_agent = user_agent
        self._cache: dict[str, robotparser.RobotFileParser | None] = {}

    def _parser_for(self, base: str) -> robotparser.RobotFileParser | None:
        if base in self._cache:
            return self._cache[base]
        rp = robotparser.RobotFileParser()
        rp.set_url(base + "/robots.txt")
        try:
            rp.read()
        except Exception:
            self._cache[base] = None
            return None
        self._cache[base] = rp
        return rp

    def check(self, url: str) -> RobotsDecision:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return RobotsDecision(False, f"Not a fetchable URL: {url!r}")
        base = f"{parsed.scheme}://{parsed.netloc}"
        rp = self._parser_for(base)
        if rp is None:
            return RobotsDecision(
                False,
                f"Could not fetch/parse {base}/robots.txt; failing closed (treating as disallowed).",
            )
        if rp.can_fetch(self.user_agent, url):
            return RobotsDecision(True, "robots.txt allows this path.")
        return RobotsDecision(False, f"{base}/robots.txt disallows this path for automated agents.")

    def allowed(self, url: str) -> bool:
        return self.check(url).allowed
