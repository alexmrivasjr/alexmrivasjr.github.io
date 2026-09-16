import sys
import urllib.robotparser as robotparser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from leadgen.robots import RobotsChecker


def test_unreachable_robots_txt_fails_closed(monkeypatch):
    def boom(self):
        raise OSError("network unreachable")

    monkeypatch.setattr(robotparser.RobotFileParser, "read", boom)
    checker = RobotsChecker()
    decision = checker.check("https://example.invalid/some/list.csv")
    assert decision.allowed is False
    assert "failing closed" in decision.reason


def test_disallowed_path_is_reported():
    checker = RobotsChecker()
    fake_rp = robotparser.RobotFileParser()
    fake_rp.parse(["User-agent: *", "Disallow: /private/"])
    checker._cache["https://example.invalid"] = fake_rp

    blocked = checker.check("https://example.invalid/private/list.csv")
    allowed = checker.check("https://example.invalid/public/list.csv")
    assert blocked.allowed is False
    assert allowed.allowed is True


def test_malformed_url_is_not_allowed():
    checker = RobotsChecker()
    decision = checker.check("not-a-url")
    assert decision.allowed is False
