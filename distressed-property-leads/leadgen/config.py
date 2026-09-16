"""County config loading. See counties/_template.yaml for the documented schema."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


class CountyConfig:
    def __init__(self, key: str, data: dict[str, Any]):
        self.key = key
        self.data = data

    @property
    def county(self) -> str:
        return self.data["county"]

    @property
    def state(self) -> str:
        return self.data["state"]

    @property
    def fips(self) -> str | None:
        return self.data.get("fips")

    def source(self, name: str) -> dict[str, Any]:
        return self.data.get("sources", {}).get(name, {}) or {}


def load_county_config(key: str, config_dir: str | Path = "counties") -> CountyConfig:
    path = Path(config_dir) / f"{key}.yaml"
    if not path.exists():
        raise FileNotFoundError(
            f"No county config at {path}. Copy counties/_template.yaml to "
            f"counties/{key}.yaml and fill it in for this county."
        )
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    for required in ("county", "state", "sources"):
        if required not in data:
            raise ValueError(f"{path} is missing required top-level key: {required!r}")
    return CountyConfig(key, data)
