from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_cors import cross_origin

from utils.pagination import get_pagination_params, paginate_items
from controllers import VehicleController
from utils.decorators import auth_required
from utils.supabase_client import (
    get_client_ip,
    insert_row,
    normalize_session,
    normalize_text,
    normalize_vehicle,
    row_belongs_to_user,
    select_rows,
    utcnow_iso,
)


vehicles_bp = Blueprint("vehicles", __name__, url_prefix="/api/vehicles")
legacy_vehicles_bp = Blueprint("legacy_vehicles", __name__, url_prefix="/api/vehiculos")
controller = VehicleController()


def _load_garage_vehicles() -> list[dict]:
    rows = select_rows(
        "vehicles",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
        order_candidates=["created_at", "updated_at", "placa"],
        desc=True,
    )
    vehicles = [normalize_vehicle(row) for row in rows]
    return _attach_session_details(vehicles)


def _is_active_vehicle(row: dict) -> bool:
    if row.get("hora_salida") or row.get("exit_time"):
        return False
    status = normalize_text(row.get("status") or row.get("estado"))
    return status in {"dentro", "activo", "active", "inside"}


def _session_sort_value(session: dict) -> str:
    return str(
        session.get("exit_time")
        or session.get("salida")
        or session.get("entry_time")
        or session.get("entrada")
        or session.get("created_at")
        or ""
    )


def _is_active_session(session: dict) -> bool:
    if session.get("exit_time") or session.get("salida"):
        return False
    status = normalize_text(session.get("status") or session.get("estado"))
    return status not in {"completed", "finished", "finalizado", "fuera", "closed", "inactive"}


def _attach_session_details(vehicles: list[dict]) -> list[dict]:
    if not vehicles:
        return vehicles

    sessions = [
        normalize_session(row)
        for row in select_rows(
            "parking_sessions",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
            order_candidates=["salida", "exit_time", "entrada", "entry_time", "created_at"],
            desc=True,
        )
    ]
    sessions_by_vehicle: dict[str, list[dict]] = {}
    sessions_by_plate: dict[str, list[dict]] = {}

    for session in sessions:
        if normalize_text(session.get("garage_id")) not in {"", normalize_text(g.current_user_garage_id)}:
            continue
        vehicle_id = str(session.get("vehicle_id") or session.get("vehiculo_id") or "")
        plate = normalize_text(session.get("plate") or session.get("placa"))
        if vehicle_id:
            sessions_by_vehicle.setdefault(vehicle_id, []).append(session)
        if plate:
            sessions_by_plate.setdefault(plate, []).append(session)

    enriched: list[dict] = []
    for vehicle in vehicles:
        vehicle_sessions = sessions_by_vehicle.get(str(vehicle.get("id") or ""), [])
        if not vehicle_sessions:
            vehicle_sessions = sessions_by_plate.get(normalize_text(vehicle.get("plate") or vehicle.get("placa")), [])

        active_session = next((session for session in vehicle_sessions if _is_active_session(session)), None)
        latest_session = active_session or next(
            (session for session in sorted(vehicle_sessions, key=_session_sort_value, reverse=True)),
            None,
        )

        if not latest_session:
            enriched.append(vehicle)
            continue

        is_active = _is_active_session(latest_session)
        entry_time = latest_session.get("entry_time") or latest_session.get("entrada")
        exit_time = latest_session.get("exit_time") or latest_session.get("salida")
        amount = latest_session.get("amount") or latest_session.get("monto_total") or latest_session.get("costo") or 0
        duration = latest_session.get("duration_minutes") or latest_session.get("duracion") or 0

        enriched.append(
            {
                **vehicle,
                "session_id": latest_session.get("id"),
                "parking_session_id": latest_session.get("id"),
                "hora_entrada": entry_time,
                "entry_time": entry_time,
                "hora_salida": exit_time,
                "exit_time": exit_time,
                "duracion": duration,
                "duration_minutes": duration,
                "monto_total": amount,
                "amount": amount,
                "total_amount": amount,
                "payment_status": latest_session.get("payment_status"),
                "paid": latest_session.get("paid"),
                "paid_at": latest_session.get("paid_at"),
                "espacio_id": latest_session.get("space_id") or vehicle.get("space_id") or vehicle.get("espacio_id"),
                "space_id": latest_session.get("space_id") or vehicle.get("space_id") or vehicle.get("espacio_id"),
                "espacio": latest_session.get("space_code") or latest_session.get("espacio") or vehicle.get("espacio"),
                "space_code": latest_session.get("space_code") or latest_session.get("espacio") or vehicle.get("space_code"),
                "status": "dentro" if is_active else "fuera",
                "estado": "dentro" if is_active else "fuera",
                "is_active": is_active,
            }
        )

    return enriched


def _json_paginated_rows(rows: list[dict]):
    pagination = get_pagination_params()
    if not pagination["enabled"]:
        return jsonify({"success": True, "data": rows})
    page_rows, meta = paginate_items(rows, page=pagination["page"], page_size=pagination["page_size"])
    return jsonify({"success": True, "data": page_rows, "meta": meta})


@vehicles_bp.get("")
@auth_required
def list_user_vehicles():
    vehicles = [
        row
        for row in _load_garage_vehicles()
        if row_belongs_to_user(row, g.current_user_id, g.current_user_email)
    ]
    pagination = get_pagination_params()
    if not pagination["enabled"]:
        return jsonify({"success": True, "data": vehicles})
    page_rows, meta = paginate_items(vehicles, page=pagination["page"], page_size=pagination["page_size"])
    return jsonify({"success": True, "data": page_rows, "meta": meta})


@vehicles_bp.post("")
@auth_required
def create_vehicle():
    return controller.create()


@vehicles_bp.get("/garage/<garage_id>")
@auth_required
def list_garage_vehicles(garage_id: str):
    if normalize_text(garage_id) != normalize_text(g.current_user_garage_id):
        return jsonify({"success": False, "error": "No autorizado para consultar ese garage"}), 403

    rows = _load_garage_vehicles()
    return _json_paginated_rows(rows)


@vehicles_bp.get("/garage/<garage_id>/active")
@cross_origin()
@auth_required
def list_active_garage_vehicles(garage_id: str):
    if normalize_text(garage_id) != normalize_text(g.current_user_garage_id):
        return jsonify({"success": False, "error": "No autorizado para consultar ese garage"}), 403

    rows = [row for row in _load_garage_vehicles() if _is_active_vehicle(row)]
    return _json_paginated_rows(rows)


@legacy_vehicles_bp.route("/activos", methods=["GET", "OPTIONS"])
@cross_origin()
@auth_required
def list_active_vehicles_legacy():
    rows = [row for row in _load_garage_vehicles() if _is_active_vehicle(row)]
    return _json_paginated_rows(rows)


@vehicles_bp.get("/search")
@auth_required
def search_vehicles():
    return controller.search()


@vehicles_bp.put("/<vehicle_id>")
@auth_required
def update_vehicle(vehicle_id: str):
    return controller.update(vehicle_id)


@vehicles_bp.delete("/<vehicle_id>")
@auth_required
def delete_vehicle(vehicle_id: str):
    return controller.delete(vehicle_id)
