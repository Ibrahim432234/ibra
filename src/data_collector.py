"""
Data collector module for retrieving price data from MetaTrader 5.

This script connects to MT5 via the official Python API, fetches tick or M1 data,
and persists it to CSV files for downstream processing. It is designed for demo
and research purposes and should be run against a demo account first.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import MetaTrader5 as mt5
import pandas as pd

from src.utils.config import Config, load_config

LOGGER = logging.getLogger("data_collector")


def configure_logging(log_dir: Path) -> None:
    """Configure basic logging to console and rotating file."""
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "collector.log"
    handler_file = logging.FileHandler(log_file, encoding="utf-8")
    handler_console = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler_file.setFormatter(formatter)
    handler_console.setFormatter(formatter)

    LOGGER.setLevel(logging.INFO)
    LOGGER.addHandler(handler_file)
    LOGGER.addHandler(handler_console)


def initialize_mt5(login: Optional[int] = None, server: Optional[str] = None, password: Optional[str] = None) -> None:
    """Initialize MetaTrader5 connection with optional credentials."""
    if mt5.initialize(login=login, server=server, password=password):
        LOGGER.info("MetaTrader5 initialized successfully.")
    else:
        error_code, error_message = mt5.last_error()
        LOGGER.error("MetaTrader5 initialization failed: %s (%s)", error_message, error_code)
        raise RuntimeError("Failed to initialize MetaTrader5")


def fetch_latest_tick(symbol: str) -> pd.DataFrame:
    """Fetch the latest tick for the specified symbol."""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise RuntimeError(f"No tick data for symbol {symbol}")

    timestamp = datetime.fromtimestamp(tick.time, tz=timezone.utc)
    return pd.DataFrame(
        [
            {
                "time": timestamp,
                "bid": tick.bid,
                "ask": tick.ask,
                "last": tick.last,
                "volume": tick.volume,
                "flags": tick.flags,
            }
        ]
    )


def fetch_m1(symbol: str, n_bars: int = 1) -> pd.DataFrame:
    """Fetch the last n_bars M1 bars for the given symbol."""
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, n_bars)
    if rates is None:
        raise RuntimeError(f"No M1 data for symbol {symbol}")

    frame = pd.DataFrame(rates)
    frame["time"] = pd.to_datetime(frame["time"], unit="s", utc=True)
    return frame


def append_to_csv(frame: pd.DataFrame, output_path: Path) -> None:
    """Append dataframe rows to a CSV file, creating the file if it does not exist."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    header = not output_path.exists()
    frame.to_csv(output_path, mode="a", header=header, index=False)
    LOGGER.info("Wrote %d rows to %s", len(frame), output_path)


def run_loop(config: Config, mode: str, output_path: Path, interval_seconds: int) -> None:
    """Run the collection loop indefinitely."""
    LOGGER.info("Starting collection loop in %s mode (interval=%ss)", mode, interval_seconds)
    try:
        while True:
            if mode == "tick":
                frame = fetch_latest_tick(config.symbol)
            else:
                frame = fetch_m1(config.symbol)

            append_to_csv(frame, output_path)
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        LOGGER.info("Collection interrupted by user.")
    finally:
        mt5.shutdown()
        LOGGER.info("MetaTrader5 shutdown complete.")


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Collect MT5 market data to CSV.")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config/default.yaml"),
        help="Path to YAML configuration file.",
    )
    parser.add_argument(
        "--mode",
        choices=("tick", "m1"),
        default="m1",
        help="Collection mode (tick or m1 bars).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/collector.csv"),
        help="CSV file where data is appended.",
    )
    parser.add_argument(
        "--sleep",
        type=int,
        default=60,
        help="Sleep interval between requests in seconds.",
    )
    parser.add_argument("--login", type=int, help="MT5 account login (optional).")
    parser.add_argument("--server", type=str, help="MT5 server name (optional).")
    parser.add_argument("--password", type=str, help="MT5 password (optional).")
    parser.add_argument(
        "--log-dir",
        type=Path,
        default=Path("logs"),
        help="Directory for log files.",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point for the data collector."""
    args = parse_args()
    config = load_config(args.config)
    configure_logging(args.log_dir)
    initialize_mt5(login=args.login, server=args.server, password=args.password)
    run_loop(config, args.mode, args.output, args.sleep)


if __name__ == "__main__":
    main()

