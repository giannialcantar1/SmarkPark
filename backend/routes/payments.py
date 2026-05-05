from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from controllers import PaymentController
from utils.decorators import auth_required
from utils.supabase_client import insert_row, normalize_session, select_rows, update_rows, utcnow_iso


payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")
controller = PaymentController()


def _garage_sessions() -> list[dict]:
    rows = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
        order_candidates=["entrada", "entry_time", "created_at"],
        desc=True,
    )

    vehicles = {
        str(row.get("id")): row
        for row in select_rows(
            "vehicles",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["created_at"],
            desc=True,
        )
    }
    spaces = {
        str(row.get("id")): row
        for row in select_rows(
            "parking_spaces",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["numero", "piso"],
        )
    }

    sessions: list[dict] = []
    for row in rows:
        normalized = normalize_session(row)
        vehicle = vehicles.get(str(normalized.get("vehicle_id")))
        space = spaces.get(str(normalized.get("space_id")))
        if normalized.get("garage_id") == g.current_user_garage_id or vehicle or space:
            sessions.append(normalized)
    return sessions


@payments_bp.post("")
@auth_required
def create_payment():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id") or "").strip()
    payment_method = str(payload.get("payment_method") or payload.get("metodo") or "").strip()

    try:
        amount = float(payload.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "amount debe ser numerico"}), 400

    if not session_id or not payment_method:
        return jsonify({"success": False, "error": "session_id y payment_method son requeridos"}), 400

    session = next((row for row in _garage_sessions() if str(row.get("id")) == session_id), None)
    if not session:
        return jsonify({"success": False, "error": "Sesion no encontrada"}), 404

    payment = insert_row(
        "payments",
        {
            "session_id": session_id,
            "monto": round(amount, 2),
            "amount": round(amount, 2),
            "metodo": payment_method,
            "payment_method": payment_method,
            "estado": "pagado",
            "status": "paid",
            "fecha": utcnow_iso(),
            "paid_at": utcnow_iso(),
            "created_at": utcnow_iso(),
        },
    )

    update_rows(
        "parking_sessions",
        payload={
            "payment_status": "paid",
            "paid": True,
            "paid_at": utcnow_iso(),
        },
        filters=[
            {"column": "id", "value": session_id, "optional": False},
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": True},
        ],
    )

    return jsonify({"success": True, "message": "Pago registrado", "data": payment}), 201


@payments_bp.get("")
@auth_required
def list_payments():
    return controller.list()


@payments_bp.get("/receipt/<session_id>")
@auth_required
def payment_receipt(session_id: str):
    return controller.get_receipt(session_id)
