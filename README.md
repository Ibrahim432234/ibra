# Experimentelles ML-Trading-Projekt (Demo)

Dieses Repository enthält ein Forschungs-Setup, um ein sehr risikoreiches Intraday-Handelssystem zu prototypen. Ziel ist es, mit Machine-Learning-Signalen und automatisierter Ausführung experimentell von 20 € Startkapital auf 100 € in einer Stunde zu kommen – ausschließlich auf Demo-Konten.

## Komponentenüberblick
- **Data Collector (`src/data_collector.py`)**: Lädt Tick- oder M1-Daten aus MetaTrader 5 und speichert sie in `data/raw/`.
- **Feature Engine (`src/feature_engineering.py`)**: Berechnet technische Indikatoren (EMA, RSI, MACD, ATR usw.) und erzeugt beschriftete Trainingsdaten in `data/processed/`.
- **Modelltraining (`src/train_model.py`)**: Trainiert zunächst ein XGBoost-/RandomForest-Modell mit zeitbasierter Cross-Validation und speichert Artefakte in `models/`.
- **Execution Engine (`src/execution.py`)**: Nutzt das trainierte Modell, kalkuliert Positionsgrößen und sendet Demo-Trades via MT5.

## Getting Started
1. Umgebung vorbereiten: `python3 -m venv .venv && source .venv/bin/activate`
2. Abhängigkeiten installieren: `pip install -r requirements.txt`
3. MT5 konfigurieren (Demo-Konto, Algorithmic Trading aktivieren).
4. Daten sammeln: `python src/data_collector.py --mode m1`
5. Features erzeugen: `python src/feature_engineering.py`
6. Modell trainieren: `python src/train_model.py`
7. Demo-Ausführung testen: `python src/execution.py --prob-threshold 0.8`

Weitere Details und Metriken können im Notebook `notebooks/01_backtest.ipynb` dokumentiert werden.
