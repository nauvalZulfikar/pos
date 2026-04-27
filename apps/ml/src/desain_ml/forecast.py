"""Prophet-based demand forecasting.

Cold-start: requires 90 days of data. The API surfaces a `still_collecting`
status rather than producing meaningless forecasts on insufficient history.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Point:
    date: str
    value: float


MIN_HISTORY_DAYS = 90


def forecast_demand(
    history: list[Any],
    horizon_days: int,
    weekly_seasonality: bool = True,
) -> tuple[list[Point], list[Point], list[Point]]:
    """Returns (forecast, lower_bound, upper_bound)."""
    if len(history) < MIN_HISTORY_DAYS:
        # Insufficient history — return empty so the caller surfaces the cold-start message.
        return [], [], []

    # Lazy imports so the module can be imported in tests without prophet installed.
    import pandas as pd
    from prophet import Prophet  # type: ignore[import-not-found]

    df = pd.DataFrame(
        {
            "ds": pd.to_datetime([p.date for p in history]),
            "y": [p.value for p in history],
        }
    )

    model = Prophet(weekly_seasonality=weekly_seasonality, daily_seasonality=False)
    model.fit(df)

    future = model.make_future_dataframe(periods=horizon_days, freq="D")
    fc = model.predict(future).tail(horizon_days)

    forecast = [Point(date=str(d.date()), value=float(v)) for d, v in zip(fc["ds"], fc["yhat"], strict=True)]
    lower = [Point(date=str(d.date()), value=float(v)) for d, v in zip(fc["ds"], fc["yhat_lower"], strict=True)]
    upper = [Point(date=str(d.date()), value=float(v)) for d, v in zip(fc["ds"], fc["yhat_upper"], strict=True)]
    return forecast, lower, upper
