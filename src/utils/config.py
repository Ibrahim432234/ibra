"""
Configuration utilities for the ML trading project.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

import yaml


@dataclass
class Config:
    """Typed access to project configuration settings."""

    symbol: str
    timeframe: str
    data_collection: Dict[str, Any]
    feature_engineering: Dict[str, Any]
    model: Dict[str, Any]
    execution: Dict[str, Any]


def load_config(path: str | Path) -> Config:
    """
    Load configuration from a YAML file.

    Parameters
    ----------
    path:
        Path to the YAML configuration file.

    Returns
    -------
    Config
        Parsed configuration dataclass.
    """
    config_path = Path(path)
    with config_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    return Config(**data)

