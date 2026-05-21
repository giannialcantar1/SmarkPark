from __future__ import annotations

from typing import Any

from repositories.base_repository import BaseRepository


def _first_present(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return default


def normalize_payment(row: dict[str, Any]) -> dict[str, Any]:
    amount_value = _first_present(row, "monto", "amount", default=0)
    try:
        amount = round(float(amount_value or 0), 2)
    except (TypeError, ValueError):
        amount = 0.0

    return {
        **row,
        "id": row.get("id"),
        "session_id": _first_present(row, "session_id", "parking_session_id"),
        "monto": amount,
        "amount": amount,
        "metodo": _first_present(row, "metodo", "payment_method", "method", default=""),
        "payment_method": _first_present(row, "metodo", "payment_method", "method", default=""),
        "referencia": _first_present(row, "referencia", "payment_reference", "reference", default=""),
        "payment_reference": _first_present(row, "referencia", "payment_reference", "reference", default=""),
        "estado": _first_present(row, "estado", "status", default="pendiente"),
        "status": _first_present(row, "estado", "status", default="pendiente"),
        "fecha": _first_present(row, "fecha", "created_at"),
        "created_at": row.get("created_at") or row.get("fecha"),
    }


class PaymentRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("payments", normalizer=normalize_payment)

    def get_by_session(self, session_id: str) -> list[dict]:
        return self.get_all(
            filters=[{"column": "session_id", "value": session_id, "optional": False}],
            order_candidates=["fecha", "created_at"],
            desc=True,
        )
