"""
Model training pipeline for the ML trading project.

Trains a baseline classifier (XGBoost or scikit-learn fallback) on engineered features
and persists the trained model artifact along with evaluation metrics.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler

from src.utils.config import Config, load_config

try:
    from xgboost import XGBClassifier  # type: ignore
except ImportError:  # pragma: no cover - fallback
    from sklearn.ensemble import RandomForestClassifier as XGBClassifier  # type: ignore


def train_model(frame: pd.DataFrame, config: Config) -> Tuple[Any, Dict[str, Any]]:
    """
    Train a classifier using time-based cross-validation.

    Returns the trained model from the final split and aggregated metrics.
    """
    feature_cols = [
        col for col in frame.columns if col not in {"time", "target"}
    ]
    X = frame[feature_cols].values
    y = frame["target"].values

    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    tscv = TimeSeriesSplit(n_splits=5)
    metrics: Dict[str, Any] = {"folds": []}
    model = None

    for idx, (train_idx, test_idx) in enumerate(tscv.split(X, y), start=1):
        model = XGBClassifier(**config.model.get("xgboost_params", {}))
        model.fit(X[train_idx], y[train_idx])

        y_pred = model.predict(X[test_idx])
        report = classification_report(y[test_idx], y_pred, output_dict=True)
        metrics["folds"].append({"fold": idx, "report": report})

    if model is None:
        raise RuntimeError("Model training failed: no folds were processed.")

    metrics["feature_columns"] = feature_cols
    metrics["scaler_mean"] = scaler.mean_.tolist()
    metrics["scaler_scale"] = scaler.scale_.tolist()

    return (model, scaler), metrics


def save_artifacts(model_bundle: Tuple[Any, StandardScaler], metrics: Dict[str, Any], output_dir: Path) -> None:
    """Persist trained model, scaler, and metrics to disk."""
    output_dir.mkdir(parents=True, exist_ok=True)
    model, scaler = model_bundle

    model_path = output_dir / "model.ubj"
    scaler_path = output_dir / "scaler.npy"
    metrics_path = output_dir / "metrics.json"

    try:
        model.save_model(model_path)  # type: ignore[attr-defined]
    except AttributeError:
        import joblib

        joblib.dump(model, model_path)

    np.save(scaler_path, {"mean": scaler.mean_, "scale": scaler.scale_}, allow_pickle=True)

    with metrics_path.open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Train ML model for intraday trading signals.")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config/default.yaml"),
        help="Path to YAML configuration file.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/processed/features.parquet"),
        help="Path to features dataset.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("models"),
        help="Directory where artifacts are stored.",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point for model training."""
    args = parse_args()
    config = load_config(args.config)

    frame = pd.read_parquet(args.input)
    model_bundle, metrics = train_model(frame, config)

    save_artifacts(model_bundle, metrics, args.output)
    print(f"Model training complete. Artifacts saved to {args.output}")


if __name__ == "__main__":
    main()

