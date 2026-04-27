"""Z-score-based anomaly detection on a time series.

Works from week 1 (uses simple rolling baseline). AGENTS.md §14.3.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Anomaly:
    date: str
    value: float
    expected: float
    z_score: float
    severity: str  # low | medium | high


def detect_anomalies(history: list[Any], sensitivity: float = 2.5) -> list[Anomaly]:
    if len(history) < 7:
        return []

    import numpy as np

    values = np.asarray([p.value for p in history], dtype=float)
    rolling_mean = np.convolve(values, np.ones(7) / 7, mode="valid")
    out: list[Anomaly] = []
    # Pad the rolling mean with the first stable value for the first 6 entries.
    expected = np.concatenate([np.full(6, rolling_mean[0]), rolling_mean])

    std = float(np.std(values))
    if std == 0.0:
        return []

    for i, p in enumerate(history):
        z = (values[i] - expected[i]) / std
        if abs(z) >= sensitivity:
            severity = "high" if abs(z) >= sensitivity * 1.5 else ("medium" if abs(z) >= sensitivity else "low")
            out.append(
                Anomaly(
                    date=p.date,
                    value=float(values[i]),
                    expected=float(expected[i]),
                    z_score=float(z),
                    severity=severity,
                )
            )
    return out
