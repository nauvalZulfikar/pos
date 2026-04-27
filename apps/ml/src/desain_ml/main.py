"""FastAPI entry point.

Endpoints
---------
POST /v1/forecast/demand   — Prophet-based demand forecast.
POST /v1/anomaly/detect    — anomaly detection on a time series.
POST /v1/menu/score        — BCG-matrix menu performance scoring.
GET  /healthz, /readyz
"""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel

from .anomaly import detect_anomalies
from .forecast import forecast_demand
from .menu_score import score_menu

app = FastAPI(title="DESAIN POS — ML", version="0.0.1")
security = HTTPBearer(auto_error=False)


def _verify(token: HTTPAuthorizationCredentials | None = Depends(security)) -> dict[str, object]:
    secret = os.getenv("ML_SERVICE_JWT_SECRET")
    if not secret:
        # Allow unauthenticated in dev only.
        if os.getenv("NODE_ENV", "development") == "production":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "ML_SERVICE_JWT_SECRET missing")
        return {"sub": "dev"}
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer")
    try:
        return jwt.decode(token.credentials, secret, algorithms=["HS256"])
    except jwt.PyJWTError as e:  # pragma: no cover
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e


class TimeSeriesPoint(BaseModel):
    date: str  # ISO date
    value: float


class ForecastRequest(BaseModel):
    history: list[TimeSeriesPoint]
    horizon_days: int = 14
    weekly_seasonality: bool = True


class ForecastResponse(BaseModel):
    forecast: list[TimeSeriesPoint]
    confidence_low: list[TimeSeriesPoint]
    confidence_high: list[TimeSeriesPoint]


class AnomalyRequest(BaseModel):
    history: list[TimeSeriesPoint]
    sensitivity: float = 2.5  # z-score threshold


class AnomalyResult(BaseModel):
    date: str
    value: float
    expected: float
    z_score: float
    severity: str


class AnomalyResponse(BaseModel):
    anomalies: list[AnomalyResult]


class MenuScoreItem(BaseModel):
    menu_item_id: str
    name: str
    quantity: int
    revenue: float
    margin: float


class MenuScoreRequest(BaseModel):
    period_days: int
    items: list[MenuScoreItem]


class MenuScoreResult(BaseModel):
    menu_item_id: str
    name: str
    category: str  # sapi_perah | bintang | tanda_tanya | anjing
    rationale: str


class MenuScoreResponse(BaseModel):
    results: list[MenuScoreResult]


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.get("/readyz")
def readyz() -> dict[str, bool]:
    return {"ready": True}


@app.post("/v1/forecast/demand", response_model=ForecastResponse)
def post_forecast(req: ForecastRequest, _: object = Depends(_verify)) -> ForecastResponse:
    f, lo, hi = forecast_demand(req.history, req.horizon_days, req.weekly_seasonality)
    return ForecastResponse(
        forecast=[TimeSeriesPoint(date=p.date, value=p.value) for p in f],
        confidence_low=[TimeSeriesPoint(date=p.date, value=p.value) for p in lo],
        confidence_high=[TimeSeriesPoint(date=p.date, value=p.value) for p in hi],
    )


@app.post("/v1/anomaly/detect", response_model=AnomalyResponse)
def post_anomaly(req: AnomalyRequest, _: object = Depends(_verify)) -> AnomalyResponse:
    out = detect_anomalies(req.history, req.sensitivity)
    return AnomalyResponse(
        anomalies=[
            AnomalyResult(
                date=a.date,
                value=a.value,
                expected=a.expected,
                z_score=a.z_score,
                severity=a.severity,
            )
            for a in out
        ]
    )


@app.post("/v1/menu/score", response_model=MenuScoreResponse)
def post_menu_score(req: MenuScoreRequest, _: object = Depends(_verify)) -> MenuScoreResponse:
    out = score_menu(req.period_days, req.items)
    return MenuScoreResponse(
        results=[
            MenuScoreResult(
                menu_item_id=r.menu_item_id,
                name=r.name,
                category=r.category,
                rationale=r.rationale,
            )
            for r in out
        ]
    )
