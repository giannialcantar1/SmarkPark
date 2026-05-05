from __future__ import annotations

from flask import Blueprint, g, jsonify

from services import MonthlyPlanService
from utils.decorators import auth_required


morosidad_bp = Blueprint("morosidad", __name__, url_prefix="/api/morosidad")
service = MonthlyPlanService()


def _admin_only():
    if str(g.current_user_role or "").strip().lower() != "admin":
        return jsonify({"success": False, "error": "Solo un administrador puede consultar la morosidad"}), 403
    return None


@morosidad_bp.get("/usuarios")
@auth_required
def list_overdue_users():
    denied = _admin_only()
    if denied:
        return denied
    users = service.list_overdue(garage_id=g.current_user_garage_id)
    return jsonify({"success": True, "data": users})


@morosidad_bp.get("/stats")
@auth_required
def overdue_stats():
    denied = _admin_only()
    if denied:
        return denied
    stats = service.stats(garage_id=g.current_user_garage_id)
    return jsonify(
        {
            "success": True,
            "data": {
                "total_morosos": stats.get("overdue_count", 0),
                "monto_adeudado": stats.get("total_overdue_amount", 0),
            },
        }
    )
