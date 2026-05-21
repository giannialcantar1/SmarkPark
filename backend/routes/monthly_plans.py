from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services import MonthlyPlanService
from services.user_service import UserService
from utils.decorators import auth_required
from utils.supabase_client import get_user_table_client, insert_row, normalize_text, update_rows, utcnow_iso


monthly_plans_bp = Blueprint("monthly_plans", __name__, url_prefix="/api/monthly-plans")
service = MonthlyPlanService()
user_service = UserService()


def _admin_only():
    if normalize_text(g.current_user_role) != "admin":
        return jsonify({"success": False, "error": "Solo un administrador puede gestionar mensualidades"}), 403
    return None


def _user_exists(user_id: str) -> bool:
    wanted = normalize_text(user_id)
    for row in user_service.list_users(garage_id=g.current_user_garage_id):
        if wanted in {
            normalize_text(row.get("id")),
            normalize_text(row.get("auth_user_id")),
            normalize_text(row.get("user_id")),
        }:
            return True
    return False


def _current_user_owns_plan(plan_user_id: str) -> bool:
    wanted_plan_user_id = normalize_text(plan_user_id)
    wanted_current_user_id = normalize_text(g.current_user_id)
    if not wanted_plan_user_id or not wanted_current_user_id:
        return False

    for row in user_service.list_users(garage_id=g.current_user_garage_id):
        row_keys = {
            normalize_text(row.get("id")),
            normalize_text(row.get("auth_user_id")),
            normalize_text(row.get("user_id")),
        }
        if wanted_plan_user_id in row_keys and wanted_current_user_id in row_keys:
            return True
    return False


def _resolve_user_identity_keys(user_id: str) -> list[str]:
    profile = user_service.get_user(user_id=user_id)
    keys = [
        normalize_text(user_id),
        normalize_text((profile or {}).get("id")),
        normalize_text((profile or {}).get("auth_user_id")),
        normalize_text((profile or {}).get("user_id")),
    ]

    unique_keys: list[str] = []
    for key in keys:
        if key and key not in unique_keys:
            unique_keys.append(key)
    return unique_keys


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

    try:
        plan = service.create_or_update_plan(
            garage_id=g.current_user_garage_id,
            user_id=user_id,
            amount=amount,
            due_date=due_date,
            status="pendiente",
        )
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    return jsonify({"success": True, "message": "Plan mensual guardado correctamente", "data": plan}), 201


@monthly_plans_bp.get("")
@monthly_plans_bp.get("/")
@auth_required
def list_monthly_plans():
    denied = _admin_only()
    if denied:
        return denied
    try:
        plans = service.list_plans(garage_id=g.current_user_garage_id)
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    return jsonify({"success": True, "data": plans})


@monthly_plans_bp.get("/user/<user_id>")
@auth_required
def get_user_monthly_plan(user_id: str):
    if normalize_text(g.current_user_role) != "admin" and not _current_user_owns_plan(user_id):
        return jsonify({"success": False, "error": "No autorizado para consultar ese plan"}), 403

    try:
        plan = None
        for candidate_user_id in _resolve_user_identity_keys(user_id):
            plan = service.get_user_plan(garage_id=g.current_user_garage_id, user_id=candidate_user_id)
            if plan:
                break
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
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

    try:
        updated = service.mark_paid(
            garage_id=g.current_user_garage_id,
            plan_id=plan_id or None,
            user_id=user_id or None,
        )
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    if not updated:
        return jsonify({"success": False, "error": "Plan no encontrado"}), 404

    return jsonify({"success": True, "message": "Pago mensual registrado correctamente", "data": updated})


@monthly_plans_bp.get("/pending")
@auth_required
def list_pending_monthly_plans():
    denied = _admin_only()
    if denied:
        return denied
    try:
        pending = service.list_pending(garage_id=g.current_user_garage_id)
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    return jsonify({"success": True, "data": pending})


@monthly_plans_bp.post("/process-payment")
@auth_required
def process_monthly_plan_payment():
    payload = request.get_json(silent=True) or {}
    plan_id = str(payload.get("plan_id") or "").strip()
    reference = str(payload.get("reference") or "").strip()
    method = str(payload.get("method") or "").strip().lower()

    try:
        amount = round(float(payload.get("amount") or 0), 2)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "amount debe ser numerico"}), 400

    if not plan_id or not reference or amount <= 0:
        return jsonify({"success": False, "error": "plan_id, reference y amount son requeridos"}), 400
    if method not in {"card", "transfer"}:
        return jsonify({"success": False, "error": "method debe ser card o transfer"}), 400

    try:
        plans = service.list_plans(garage_id=g.current_user_garage_id)
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    target = next((row for row in plans if normalize_text(row.get("id")) == normalize_text(plan_id)), None)
    if not target:
        return jsonify({"success": False, "error": "Plan no encontrado"}), 404

    plan_user_id = str(target.get("user_id") or "").strip()
    is_admin = normalize_text(g.current_user_role) == "admin"
    if not is_admin and not _current_user_owns_plan(plan_user_id):
        return jsonify({"success": False, "error": "No autorizado para pagar ese plan"}), 403

    previous_status = str(target.get("status") or "pendiente").strip() or "pendiente"
    method_label = "tarjeta" if method == "card" else "transferencia"
    payment_row = None
    ledger_row = None

    try:
        update_rows(
            "monthly_plans",
            payload={"status": "pagado"},
            filters=[{"column": "id", "value": plan_id, "optional": False}],
        )

        payment_row = insert_row(
            "payments",
            {
                "garage_id": g.current_user_garage_id,
                "user_id": plan_user_id or None,
                "monto": amount,
                "metodo": method_label,
                "estado": "pagado",
                "fecha": utcnow_iso(),
                "created_at": utcnow_iso(),
            },
        )

        ledger_row = insert_row(
            "monthly_plan_payments",
            {
                "garage_id": g.current_user_garage_id,
                "plan_id": plan_id,
                "user_id": plan_user_id,
                "amount": amount,
                "method": method,
                "reference": reference,
                "status": "approved",
                "paid_at": utcnow_iso(),
                "created_at": utcnow_iso(),
            },
        )
    except Exception as exc:
        if payment_row and payment_row.get("id"):
            try:
                get_user_table_client(use_admin=True).table("payments").delete().eq("id", payment_row.get("id")).execute()
            except Exception:
                pass

        if ledger_row and ledger_row.get("id"):
            try:
                get_user_table_client(use_admin=True).table("monthly_plan_payments").delete().eq("id", ledger_row.get("id")).execute()
            except Exception:
                pass

        try:
            update_rows(
                "monthly_plans",
                payload={"status": previous_status},
                filters=[{"column": "id", "value": plan_id, "optional": False}],
            )
        except Exception:
            pass

        return jsonify({"success": False, "error": str(exc) or "No se pudo procesar el pago mensual"}), 500

    refreshed = next((row for row in service.list_plans(garage_id=g.current_user_garage_id) if normalize_text(row.get("id")) == normalize_text(plan_id)), None)
    return jsonify(
        {
            "success": True,
            "message": "Pago mensual procesado correctamente",
            "data": {
                "plan": refreshed or {**target, "status": "pagado"},
                "payment": payment_row,
                "ledger": ledger_row,
                "reference": reference,
            },
        }
    ), 201
