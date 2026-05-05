from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services import MonthlyPlanService
from utils.decorators import auth_required
from utils.supabase_client import normalize_text, select_rows


monthly_plans_bp = Blueprint("monthly_plans", __name__, url_prefix="/api/monthly-plans")
service = MonthlyPlanService()


def _admin_only():
    if normalize_text(g.current_user_role) != "admin":
        return jsonify({"success": False, "error": "Solo un administrador puede gestionar mensualidades"}), 403
    return None


def _user_exists(user_id: str) -> bool:
    users = select_rows(
        "users",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
        order_candidates=["created_at", "email"],
        desc=True,
        limit=500,
    )
    wanted = normalize_text(user_id)
    for row in users:
        if wanted in {
            normalize_text(row.get("id")),
            normalize_text(row.get("auth_user_id")),
            normalize_text(row.get("user_id")),
        }:
            return True
    return False


@monthly_plans_bp.post("/create")
@auth_required
def create_monthly_plan():
    denied = _admin_only()
    if denied:
        return denied
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id") or "").strip()
    due_date = str(payload.get("due_date") or "").strip()

    try:
        amount = float(payload.get("amount") or 0)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "El monto debe ser numerico"}), 400

    if not user_id or not due_date or amount <= 0:
        return jsonify({"success": False, "error": "user_id, amount y due_date son requeridos"}), 400
    if not _user_exists(user_id):
        return jsonify({"success": False, "error": "Usuario no encontrado en este garage"}), 404

    plan = service.create_or_update_plan(
        garage_id=g.current_user_garage_id,
        user_id=user_id,
        amount=amount,
        due_date=due_date,
        status="pendiente",
    )
    return jsonify({"success": True, "message": "Plan mensual guardado correctamente", "data": plan}), 201


@monthly_plans_bp.get("/user/<user_id>")
@auth_required
def get_user_monthly_plan(user_id: str):
    if normalize_text(g.current_user_role) != "admin" and normalize_text(user_id) != normalize_text(g.current_user_id):
        return jsonify({"success": False, "error": "No autorizado para consultar ese plan"}), 403

    plan = service.get_user_plan(garage_id=g.current_user_garage_id, user_id=user_id)
    return jsonify({"success": True, "data": plan})


@monthly_plans_bp.post("/pay")
@auth_required
def pay_monthly_plan():
    denied = _admin_only()
    if denied:
        return denied
    payload = request.get_json(silent=True) or {}
    plan_id = str(payload.get("plan_id") or "").strip()
    user_id = str(payload.get("user_id") or "").strip()
    if not plan_id and not user_id:
        return jsonify({"success": False, "error": "plan_id o user_id es requerido"}), 400

    updated = service.mark_paid(
        garage_id=g.current_user_garage_id,
        plan_id=plan_id or None,
        user_id=user_id or None,
    )
    if not updated:
        return jsonify({"success": False, "error": "Plan no encontrado"}), 404

    return jsonify({"success": True, "message": "Pago mensual registrado correctamente", "data": updated})


@monthly_plans_bp.get("/pending")
@auth_required
def list_pending_monthly_plans():
    denied = _admin_only()
    if denied:
        return denied
    pending = service.list_pending(garage_id=g.current_user_garage_id)
    return jsonify({"success": True, "data": pending})
