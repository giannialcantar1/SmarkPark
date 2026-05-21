from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services import MonthlyPlanService
from utils.decorators import auth_required
from utils.pagination import get_pagination_params, paginate_items


morosidad_bp = Blueprint("morosidad", __name__, url_prefix="/api/morosidad")
service = MonthlyPlanService()


def _admin_only():
    if str(g.current_user_role or "").strip().lower() != "admin":
        return jsonify({"success": False, "error": "Solo un administrador puede consultar la morosidad"}), 403
    return None


def _optional_non_negative_int(name: str) -> int | None:
    raw_value = request.args.get(name)
    if raw_value in (None, ""):
        return None
    try:
        return max(int(raw_value), 0)
    except (TypeError, ValueError):
        return None


@morosidad_bp.get("/usuarios")
@auth_required
def list_overdue_users():
    denied = _admin_only()
    if denied:
        return denied
    users = service.list_overdue_users(
        garage_id=g.current_user_garage_id,
        search=str(request.args.get("q") or "").strip(),
        min_days=_optional_non_negative_int("min_days"),
        max_days=_optional_non_negative_int("max_days"),
    )
    pagination = get_pagination_params()
    if not pagination["enabled"]:
        return jsonify({"success": True, "data": users})
    page_rows, meta = paginate_items(users, page=pagination["page"], page_size=pagination["page_size"])
    return jsonify({"success": True, "data": page_rows, "meta": meta})


@morosidad_bp.get("/stats")
@auth_required
def overdue_stats():
    denied = _admin_only()
    if denied:
        return denied
    stats = service.overdue_user_stats(
        garage_id=g.current_user_garage_id,
        search=str(request.args.get("q") or "").strip(),
        min_days=_optional_non_negative_int("min_days"),
        max_days=_optional_non_negative_int("max_days"),
    )
    return jsonify(
        {
            "success": True,
            "data": {
                "total_morosos": stats.get("overdue_count", 0),
                "monto_adeudado": stats.get("total_overdue_amount", 0),
                "dias_vencidos": stats.get("max_days_overdue", 0),
                "planes_pendientes": stats.get("pending_count", 0),
            },
        }
    )
