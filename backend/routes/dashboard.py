from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from flask import Blueprint, g, jsonify

from services import MonthlyPlanService
from utils.decorators import auth_required
from utils.supabase_client import normalize_parking_space, normalize_session, normalize_text, normalize_vehicle, parse_datetime, select_rows, utcnow


dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")
monthly_plan_service = MonthlyPlanService()


def _spaces() -> list[dict]:
    if not hasattr(g, '_cached_spaces'):
        rows = select_rows(
            "parking_spaces",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["piso", "floor", "numero", "created_at"],
        )
        g._cached_spaces = [normalize_parking_space(row) for row in rows]
    return g._cached_spaces


def _vehicles() -> list[dict]:
    if not hasattr(g, '_cached_vehicles'):
        rows = select_rows(
            "vehicles",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["created_at", "updated_at", "placa"],
            desc=True,
        )
        g._cached_vehicles = [normalize_vehicle(row) for row in rows]
    return g._cached_vehicles


def _sessions() -> list[dict]:
    if not hasattr(g, '_cached_sessions'):
        rows = select_rows(
            "parking_sessions",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
            order_candidates=["entrada", "entry_time", "created_at"],
            desc=True,
        )
        vehicles_by_id = {str(row.get("id")): row for row in _vehicles() if row.get("id")}
        spaces_by_id = {str(row.get("id")): row for row in _spaces() if row.get("id")}
        wanted_garage = normalize_text(g.current_user_garage_id)
        sessions: list[dict] = []

        for row in rows:
            normalized = normalize_session(row)
            garage_id = normalize_text(normalized.get("garage_id"))
            vehicle = vehicles_by_id.get(str(normalized.get("vehicle_id")))
            space = spaces_by_id.get(str(normalized.get("space_id")))

            if garage_id and garage_id != wanted_garage:
                continue
            if not garage_id and not vehicle and not space:
                continue

            if vehicle and not normalized.get("plate"):
                normalized["plate"] = vehicle.get("plate")
            if vehicle and not normalized.get("owner_name"):
                normalized["owner_name"] = vehicle.get("owner_name")
            sessions.append(normalized)
        g._cached_sessions = sessions
    return g._cached_sessions


def _payments() -> list[dict]:
    if not hasattr(g, '_cached_payments'):
        session_ids = {str(row.get("id")) for row in _sessions() if row.get("id")}
        rows = select_rows(
            "payments",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["fecha", "paid_at", "created_at"],
            desc=True,
        )
        payments: list[dict] = []
        for row in rows:
            session_id = str(row.get("session_id") or row.get("parking_session_id") or "")
            if session_id and session_ids and session_id not in session_ids:
                continue
            payments.append(row)
        g._cached_payments = payments
    return g._cached_payments


def _history() -> list[dict]:
    if not hasattr(g, '_cached_history'):
        rows = select_rows(
            "parking_history",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
            order_candidates=["created_at", "entrada"],
            desc=True,
        )
        g._cached_history = rows or []
    return g._cached_history


def _is_active_session(row: dict) -> bool:
    if row.get("exit_time") or row.get("salida"):
        return False
    status = normalize_text(row.get("status") or row.get("estado"))
    return status not in {"closed", "completed", "finished", "inactive", "exited", "fuera", "finalizado"}


def _money_value(row: dict, *keys: str) -> float:
    for key in keys:
        try:
            value = float(row.get(key) or 0)
        except (TypeError, ValueError):
            continue
        if value:
            return value
    return 0.0


def _payment_date(row: dict):
    return parse_datetime(row.get("fecha") or row.get("paid_at") or row.get("created_at"))


def _session_payment_date(row: dict):
    return parse_datetime(row.get("paid_at") or row.get("salida") or row.get("exit_time") or row.get("hora_fin"))


def _week_start(base_date):
    date = base_date.replace(hour=0, minute=0, second=0, microsecond=0)
    return date - timedelta(days=date.weekday())


def _is_paid_or_completed_session(row: dict) -> bool:
    if row.get("paid") is True or normalize_text(row.get("payment_status")) == "paid":
        return True
    status = normalize_text(row.get("status") or row.get("estado"))
    return status in {"completed", "finished", "exited", "fuera", "finalizado"}


@dashboard_bp.get("/stats")
@auth_required
def dashboard_stats():
    try:
        spaces = _spaces()
        vehicles = _vehicles()
        sessions = _sessions()
        payments = _payments()
        history = _history()
        vehicles_by_id = {str(row.get("id")): row for row in vehicles if row.get("id")}

        total_spaces = len(spaces)
        occupied_spaces = sum(1 for row in spaces if row.get("status") == "occupied")
        available_spaces = max(total_spaces - occupied_spaces, 0)
        active_sessions = [row for row in sessions if _is_active_session(row)]

        today = utcnow()
        today_income = 0.0
        paid_session_ids: set[str] = set()
        for payment in payments:
            session_id = str(payment.get("session_id") or payment.get("parking_session_id") or "")
            if session_id:
                paid_session_ids.add(session_id)
            paid_at = _payment_date(payment)
            if paid_at and paid_at.date() == today.date():
                today_income += _money_value(payment, "monto", "amount")

        for session in sessions:
            session_id = str(session.get("id") or "")
            if session_id in paid_session_ids or not _is_paid_or_completed_session(session):
                continue
            paid_at = _session_payment_date(session)
            if paid_at and paid_at.date() == today.date():
                today_income += _money_value(session, "monto_total", "amount", "costo", "total_amount")

        floors: dict[str, dict[str, int]] = defaultdict(lambda: {"occupied": 0, "available": 0})
        for row in spaces:
            floor = row.get("floor") or row.get("piso") or "Sin piso"
            if row.get("status") == "occupied":
                floors[floor]["occupied"] += 1
            else:
                floors[floor]["available"] += 1

        floor_stats = []
        for floor in sorted(floors):
            occupied = floors[floor]["occupied"]
            available = floors[floor]["available"]
            floor_total = occupied + available
            floor_stats.append(
                {
                    "floor": floor,
                    "occupied": occupied,
                    "available": available,
                    "percentage": round((occupied / floor_total) * 100) if floor_total else 0,
                }
            )

        recent_activity = []
        if history:
            for row in history[:10]:
                event_type = normalize_text(row.get("event_type") or row.get("type") or row.get("action")) or "entry"
                event_at = parse_datetime(row.get("created_at") or row.get("entrada") or row.get("entry_time"))
                recent_activity.append(
                    {
                        "type": "exit" if event_type == "exit" else "entry",
                        "vehicle": row.get("placa") or row.get("plate") or "N/D",
                        "owner": row.get("owner_name") or row.get("propietario") or row.get("name") or "N/D",
                        "time": event_at.strftime("%H:%M") if event_at else "--:--",
                    }
                )
        else:
            for row in sessions[:10]:
                event_at = parse_datetime(row.get("exit_time") or row.get("entry_time"))
                vehicle = vehicles_by_id.get(str(row.get("vehicle_id")))
                recent_activity.append(
                    {
                        "type": "exit" if row.get("exit_time") else "entry",
                        "vehicle": row.get("plate") or (vehicle or {}).get("plate") or "N/D",
                        "owner": row.get("owner_name") or (vehicle or {}).get("owner_name") or "N/D",
                        "time": event_at.strftime("%H:%M") if event_at else "--:--",
                    }
                )

        monthly_stats = monthly_plan_service.stats(garage_id=g.current_user_garage_id)

        weekly_income = _weekly_income(payments, sessions, paid_session_ids, today)

        return jsonify(
            {
                "totalSpaces": total_spaces,
                "occupiedSpaces": occupied_spaces,
                "availableSpaces": available_spaces,
                "todayIncome": round(today_income, 2),
                "totalVehicles": len(active_sessions) or len([row for row in vehicles if normalize_text(row.get("garage_id")) == normalize_text(g.current_user_garage_id)]),
                "occupancyPercentage": round((occupied_spaces / total_spaces) * 100) if total_spaces else 0,
                "floorStats": floor_stats,
                "recentActivity": recent_activity,
                "weeklyIncome": weekly_income,
                "monthlyPlansActive": monthly_stats.get("active_count", 0),
                "monthlyPlansPending": monthly_stats.get("pending_count", 0),
                "monthlyPlansOverdue": monthly_stats.get("overdue_count", 0),
            }
        )

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print("DASHBOARD STATS ERROR:", error_details)
        return jsonify({"success": False, "error": str(e), "traceback": error_details[:500]}), 500


def _weekly_income(payments, sessions, paid_session_ids, today):
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    income_by_day = defaultdict(float)
    week_start = _week_start(today)
    week_end = week_start + timedelta(days=7)
    
    for payment in payments:
        paid_at = _payment_date(payment)
        if paid_at and week_start <= paid_at < week_end:
            day_name = day_names[paid_at.weekday()]
            income_by_day[day_name] += _money_value(payment, "monto", "amount")

    for session in sessions:
        session_id = str(session.get("id") or "")
        if session_id in paid_session_ids or not _is_paid_or_completed_session(session):
            continue
        paid_at = _session_payment_date(session)
        if paid_at and week_start <= paid_at < week_end:
            amount = _money_value(session, "monto_total", "amount", "costo", "total_amount")
            if not amount:
                continue
            income_by_day[day_names[paid_at.weekday()]] += amount
    
    return {day: round(income_by_day.get(day, 0), 2) for day in day_names}
