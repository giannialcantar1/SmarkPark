from __future__ import annotations

from datetime import timedelta
from random import SystemRandom

from flask import Blueprint, g, jsonify, request

from services import ParkingService
from utils.decorators import auth_required
from utils.supabase_client import normalize_text, parse_datetime, select_rows, insert_row, update_rows, utcnow, utcnow_iso


access_codes_bp = Blueprint("access_codes", __name__, url_prefix="/api/access-codes")
parking_service = ParkingService()
randomizer = SystemRandom()


def _load_garage_vehicles() -> dict[str, dict]:
    rows = select_rows(
        "vehicles",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
        order_candidates=["created_at", "updated_at", "placa"],
        desc=True,
    )
    vehicles_by_id: dict[str, dict] = {}
    for row in rows:
        vehicle_id = str(row.get("id") or "")
        if vehicle_id:
            vehicles_by_id[vehicle_id] = row
    return vehicles_by_id


def _normalize_access_code(row: dict, vehicle: dict | None = None) -> dict:
    vehicle = vehicle or {}
    code = str(row.get("code") or "").strip()
    created_at = row.get("created_at")
    used_at = row.get("used_at")
    expires_at = row.get("expires_at")
    is_used = bool(used_at)
    is_expired = False

    expires_at_dt = parse_datetime(expires_at)
    if expires_at_dt:
        is_expired = expires_at_dt <= utcnow()

    return {
        "id": row.get("id"),
        "vehicle_id": row.get("vehicle_id"),
        "code": code,
        "created_at": created_at,
        "used_at": used_at,
        "expires_at": expires_at,
        "is_used": is_used,
        "is_expired": is_expired,
        "placa": str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
        "plate": str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
        "propietario": vehicle.get("propietario") or vehicle.get("owner_name") or vehicle.get("owner") or "",
        "owner_name": vehicle.get("owner_name") or vehicle.get("propietario") or vehicle.get("owner") or "",
        "modelo": vehicle.get("modelo") or vehicle.get("model") or "",
        "space_id": vehicle.get("space_id") or vehicle.get("espacio_id"),
        "espacio_id": vehicle.get("espacio_id") or vehicle.get("space_id"),
    }


def _pending_codes_for_garage() -> list[dict]:
    vehicles_by_id = _load_garage_vehicles()
    rows = select_rows(
        "access_codes",
        order_candidates=["created_at"],
        desc=True,
        limit=200,
    )

    pending_codes = []
    now = utcnow()
    for row in rows:
        vehicle = vehicles_by_id.get(str(row.get("vehicle_id") or ""))
        if not vehicle:
            continue

        used_at = row.get("used_at")
        expires_at = row.get("expires_at")
        if used_at:
            continue

        expires_at_dt = parse_datetime(expires_at)

        if expires_at_dt and expires_at_dt <= now:
            continue

        pending_codes.append(_normalize_access_code(row, vehicle))

    return pending_codes


def _generate_unique_code(existing_codes: set[str]) -> str:
    for _ in range(30):
        candidate = f"{randomizer.randint(0, 999999):06d}"
        if candidate not in existing_codes:
            return candidate
    raise ValueError("No fue posible generar un codigo unico")


@access_codes_bp.post("/generate")
@auth_required
def generate_access_code():
    payload = request.get_json(silent=True) or {}
    vehicle_id = str(payload.get("vehicle_id") or "").strip()
    expires_in_minutes = payload.get("expires_in_minutes")

    if not vehicle_id:
        return jsonify({"success": False, "error": "vehicle_id es requerido"}), 400

    vehicles_by_id = _load_garage_vehicles()
    vehicle = vehicles_by_id.get(vehicle_id)
    if not vehicle:
        return jsonify({"success": False, "error": "Vehiculo no encontrado en este garage"}), 404

    try:
        ttl_minutes = int(expires_in_minutes) if expires_in_minutes not in (None, "") else 30
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "expires_in_minutes debe ser un numero entero"}), 400
    ttl_minutes = max(5, min(ttl_minutes, 180))

    pending_for_vehicle = next(
        (
            row
            for row in _pending_codes_for_garage()
            if str(row.get("vehicle_id") or "") == vehicle_id
        ),
        None,
    )
    if pending_for_vehicle:
        return jsonify(
            {
                "success": True,
                "message": "El vehiculo ya tiene un codigo pendiente",
                "data": pending_for_vehicle,
            }
        ), 200

    existing_codes = {row.get("code", "") for row in _pending_codes_for_garage()}
    code = _generate_unique_code(existing_codes)
    created_at = utcnow()
    expires_at = created_at + timedelta(minutes=ttl_minutes)

    created = insert_row(
        "access_codes",
        {
            "vehicle_id": vehicle_id,
            "code": code,
            "created_at": created_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        },
    )

    return jsonify(
        {
            "success": True,
            "message": "Codigo generado correctamente",
            "data": _normalize_access_code(created, vehicle),
        }
    ), 201


@access_codes_bp.post("/validate")
@auth_required
def validate_access_code():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code") or "").strip()

    if not code or not code.isdigit() or len(code) != 6:
        return jsonify({"success": False, "error": "El codigo debe tener 6 digitos"}), 400

    pending_codes = _pending_codes_for_garage()
    access_code = next((row for row in pending_codes if row.get("code") == code), None)
    if not access_code:
        return jsonify({"success": False, "error": "Codigo invalido, vencido o ya utilizado"}), 404

    vehicles_by_id = _load_garage_vehicles()
    vehicle = vehicles_by_id.get(str(access_code.get("vehicle_id") or ""))
    if not vehicle:
        return jsonify({"success": False, "error": "Vehiculo asociado no disponible"}), 404

    try:
        result = parking_service.register_entry(
            garage_id=g.current_user_garage_id,
            usuario_id=g.current_user_id,
            usuario_nombre=g.current_user_name,
            placa=str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
            espacio_id=vehicle.get("space_id") or vehicle.get("espacio_id"),
            propietario=vehicle.get("propietario") or vehicle.get("owner_name") or g.current_user_name,
            modelo=vehicle.get("modelo") or vehicle.get("model"),
            marca=vehicle.get("marca") or vehicle.get("brand"),
            tipo=vehicle.get("tipo") or vehicle.get("type"),
            color=vehicle.get("color"),
        )
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 409
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc) or "No fue posible validar el codigo"}), 500

    update_rows(
        "access_codes",
        payload={"used_at": utcnow_iso()},
        filters=[{"column": "id", "value": access_code.get("id"), "optional": False}],
    )

    return jsonify(
        {
            "success": True,
            "message": "Acceso validado y entrada registrada",
            "data": {
                "code": code,
                "vehicle": {
                    "id": vehicle.get("id"),
                    "placa": str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
                    "propietario": vehicle.get("propietario") or vehicle.get("owner_name") or "",
                    "modelo": vehicle.get("modelo") or vehicle.get("model") or "",
                },
                "session": result.get("session"),
                "space": result.get("space"),
            },
        }
    ), 200


@access_codes_bp.get("/pending")
@auth_required
def list_pending_access_codes():
    return jsonify({"success": True, "data": _pending_codes_for_garage()})
