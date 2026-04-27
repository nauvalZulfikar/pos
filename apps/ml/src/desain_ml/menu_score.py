"""BCG matrix menu scoring. AGENTS.md §28.4 + Glossary.

Categories (Indonesian convention): sapi_perah | bintang | tanda_tanya | anjing.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ScoreResult:
    menu_item_id: str
    name: str
    category: str
    rationale: str


MIN_PERIOD_DAYS = 30


def score_menu(period_days: int, items: list[Any]) -> list[ScoreResult]:
    if period_days < MIN_PERIOD_DAYS or len(items) == 0:
        return []

    quantities = [it.quantity for it in items]
    margins = [it.margin for it in items]

    median_qty = sorted(quantities)[len(quantities) // 2]
    median_margin = sorted(margins)[len(margins) // 2]

    out: list[ScoreResult] = []
    for it in items:
        high_volume = it.quantity >= median_qty
        high_margin = it.margin >= median_margin

        if high_volume and high_margin:
            cat = "bintang"
            rationale = "Volume tinggi, margin tinggi — pertahankan posisi unggulan."
        elif high_volume and not high_margin:
            cat = "sapi_perah"
            rationale = "Volume tinggi tapi margin tipis — review harga atau resep cost."
        elif not high_volume and high_margin:
            cat = "tanda_tanya"
            rationale = "Margin bagus tapi penjualan rendah — coba dorong via promosi."
        else:
            cat = "anjing"
            rationale = "Volume + margin sama-sama rendah — pertimbangkan dihapus dari menu."

        out.append(
            ScoreResult(
                menu_item_id=it.menu_item_id,
                name=it.name,
                category=cat,
                rationale=rationale,
            )
        )
    return out
