"""
Execution engine for live (demo) trading with MetaTrader 5.

This script loads the trained model and configuration, monitors the target symbol,
makes short-term predictions, and sends orders to MT5 when criteria are met.
It is intentionally conservative and should be used on demo accounts only.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Tuple

import MetaTrader5 as mt5
import numpy as np
import pandas as pd

from src.feature_engineering import compute_features
from src.utils.config import Config, load_config

LOGGER = logging.getLogger("execution")


def configure_logging(log_dir: Path) -> None:
    """Configure logging for execution."""
    log_dir.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler_file = logging.FileHandler(log_dir / "execution.log", encoding="utf-8")
    handler_console = logging.StreamHandler(sys.stdout)
    handler_file.setFormatter(formatter)
    handler_console.setFormatter(formatter)
    LOGGER.setLevel(logging.INFO)
    LOGGER.addHandler(handler_file)
    LOGGER.addHandler(handler_console)


def initialize_mt5(login: int | None, server: str | None, password: str | None) -> None:
    """Initialize MetaTrader5 connection."""
    if mt5.initialize(login=login, server=server, password=password):
        LOGGER.info("MetaTrader5 initialized.")
    else:
        error_code, error_message = mt5.last_error()
        LOGGER.error("MT5 initialization failed: %s (%s)", error_message, error_code)
        raise RuntimeError("MetaTrader5 initialization failed.")


def load_model_and_scaler(models_dir: Path) -> Tuple[Any, Dict[str, Any]]:
    """Load the trained model, scaler statistics, and metadata."""
    model_path = models_dir / "model.ubj"
    scaler_path = models_dir / "scaler.npy"
    metrics_path = models_dir / "metrics.json"

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    try:
        from xgboost import XGBClassifier  # type: ignore

        model = XGBClassifier()
        model.load_model(model_path)
    except ImportError:
        import joblib

        model = joblib.load(model_path)

    scaler_data = np.load(scaler_path, allow_pickle=True).item()

    import json

    with metrics_path.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)

    return (model, scaler_data, metadata)


def fetch_recent_rates(symbol: str, window: int) -> pd.DataFrame:
    """Fetch recent M1 bars to construct features."""
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, window)
    if rates is None:
        raise RuntimeError(f"Unable to fetch rates for {symbol}")
    frame = pd.DataFrame(rates)
    frame["time"] = pd.to_datetime(frame["time"], unit="s", utc=True)
    frame.rename(columns={"close": "bid"}, inplace=True)
    frame["ask"] = frame["bid"]  # Placeholder; adjust with real ask data if available.
    return frame


def prepare_inference_frame(frame: pd.DataFrame, config: Config) -> pd.DataFrame:
    """
    Compute features for the most recent observation to feed the model.

    Returns the latest row of engineered features.
    """
    features = compute_features(frame.copy(), config)
    return features.tail(1)


def predict_signal(row: pd.DataFrame, model: Any, scaler_stats: Dict[str, Any], metadata: Dict[str, Any]) -> float:
    """Produce a probability for the positive class."""
    feature_cols = metadata["feature_columns"]
    X = row[feature_cols].values

    mean = np.array(scaler_stats["mean"])
    scale = np.array(scaler_stats["scale"])
    X = (X - mean) / scale

    proba = model.predict_proba(X)[0, 1]
    return float(proba)


def calculate_lot_size(balance: float, config: Config) -> float:
    """Calculate position size based on risk configuration."""
    risk_pct = config.execution.get("risk_per_trade", 0.01)
    pip_value = config.execution.get("pip_value", 10)
    stop_loss_pips = config.execution.get("stop_loss_pips", 200)

    risk_amount = balance * risk_pct
    lot_size = risk_amount / (pip_value * stop_loss_pips)
    return round(max(lot_size, config.execution.get("min_lot", 0.01)), 2)


def place_order(symbol: str, direction: str, lot: float, config: Config) -> None:
    """Submit a market order with configured SL/TP."""
    price = mt5.symbol_info_tick(symbol).ask if direction == "buy" else mt5.symbol_info_tick(symbol).bid
    deviation = config.execution.get("deviation", 20)
    sl_points = config.execution.get("stop_loss_pips", 200)
    tp_points = config.execution.get("take_profit_pips", 400)

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot,
        "type": mt5.ORDER_TYPE_BUY if direction == "buy" else mt5.ORDER_TYPE_SELL,
        "price": price,
        "sl": price - sl_points * mt5.symbol_info(symbol).point if direction == "buy" else price + sl_points * mt5.symbol_info(symbol).point,
        "tp": price + tp_points * mt5.symbol_info(symbol).point if direction == "buy" else price - tp_points * mt5.symbol_info(symbol).point,
        "deviation": deviation,
        "magic": config.execution.get("magic_number", 123456),
        "comment": "ML-trading-demo",
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    LOGGER.info("Sending %s order: %s", direction.upper(), request)
    result = mt5.order_send(request)
    if result is None:
        LOGGER.error("Order send failed: %s", mt5.last_error())
        return

    LOGGER.info("Order response: %s", result)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute ML-based trading strategy on MT5.")
    parser.add_argument("--config", type=Path, default=Path("config/default.yaml"))
    parser.add_argument("--models-dir", type=Path, default=Path("models"))
    parser.add_argument("--log-dir", type=Path, default=Path("logs"))
    parser.add_argument("--login", type=int)
    parser.add_argument("--server", type=str)
    parser.add_argument("--password", type=str)
    parser.add_argument("--prob-threshold", type=float, default=0.8)
    parser.add_argument("--window", type=int, default=500, help="Number of M1 bars to fetch for features.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config(args.config)
    configure_logging(args.log_dir)
    initialize_mt5(args.login, args.server, args.password)

    model, scaler_stats, metadata = load_model_and_scaler(args.models_dir)
    account_info = mt5.account_info()
    if account_info is None:
        LOGGER.error("Failed to retrieve account info.")
        return

    balance = account_info.balance
    frame = fetch_recent_rates(config.symbol, args.window)
    features_row = prepare_inference_frame(frame, config)
    probability = predict_signal(features_row, model, scaler_stats, metadata)

    LOGGER.info("Predicted probability for upward move: %.3f", probability)
    threshold = args.prob_threshold

    if probability >= threshold:
        lot_size = calculate_lot_size(balance, config)
        place_order(config.symbol, "buy", lot_size, config)
    elif probability <= 1 - threshold:
        lot_size = calculate_lot_size(balance, config)
        place_order(config.symbol, "sell", lot_size, config)
    else:
        LOGGER.info("No trade signal (probability below thresholds).")

    mt5.shutdown()


if __name__ == "__main__":
    main()

