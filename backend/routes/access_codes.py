from __future__ import annotations

from datetime import timedelta
from random import SystemRandom

from flask import Blueprint, g, jsonify, request

from services import ParkingService
from utils.decorators import auth_required
from utils.supabase_client import (
    get_user_table_client,
    normalize_text,
    parse_datetime,
    select_rows,
    insert_row,
    update_rows,
    utcnow,
    utcnow_iso,
)


access_codes_bp = Blueprint("access_codes", __name__, url_prefix="/api/access-codes")
print(f"[DEBUG] Access codes blueprint created with prefix: {access_codes_bp.url_prefix}")
parking_service = ParkingService()
randomizer = SystemRandom()
ACCESS_CODES_TABLE = "access_codes"


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
        ACCESS_CODES_TABLE,
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
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
        ACCESS_CODES_TABLE,
        {
            "garage_id": g.current_user_garage_id,
            "vehicle_id": vehicle_id,
            "code": code,
            "created_at": created_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        },
    )
    print(f"[DEBUG generate] insert_row returned: {created}")

    return jsonify(
        {
            "success": True,
            "message": "Codigo generado correctamente",
            "data": _normalize_access_code(created, vehicle),
        }
    ), 201


@access_codes_bp.post("/validate")
def validate_access_code():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code") or "").strip()

    garage_id = request.headers.get("X-Garage-ID", "").strip()
    if not garage_id:
        return jsonify({"success": False, "error": "garage_id requerido"}), 400

    g.current_user_garage_id = garage_id
    g.current_user_id = None
    g.current_user_name = "Acceso por codigo"
    print(f"[DEBUG validate] garage_id={garage_id}, code={code}")

    if not code or not code.isdigit() or len(code) != 6:
        return jsonify({"success": False, "error": "El codigo debe tener 6 digitos"}), 400

    vehicles_by_id = _load_garage_vehicles()
    print(f"[DEBUG validate] vehiculos cargados para garage {garage_id}: {len(vehicles_by_id)}")

    # Leemos con el cliente admin sin fallback para evitar que una policy RLS
    # o una key anon termine devolviendo 0 filas en silencio.
    try:
        admin_client = get_user_table_client(use_admin=True, allow_fallback=False)
        response = (
            admin_client
            .table(ACCESS_CODES_TABLE)
            .select("*")
            .eq("code", code)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        code_rows = response.data or []
        print(f"[DEBUG validate] query {ACCESS_CODES_TABLE} con admin client OK")
    except Exception as exc:
        print(f"[DEBUG validate] error consultando {ACCESS_CODES_TABLE} con admin client: {exc}")
        return jsonify({"success": False, "error": "No fue posible consultar los codigos de acceso"}), 500
    print(f"[DEBUG validate] code_rows encontrados: {len(code_rows)} -> {code_rows}")

    now = utcnow()
    access_code_row = None
    vehicle = None
    for row in code_rows:
        vehicle_id = str(row.get("vehicle_id") or "")
        candidate_vehicle = vehicles_by_id.get(vehicle_id)
        row_garage_id = str(row.get("garage_id") or "").strip()
        print(
            f"[DEBUG validate] evaluando row id={row.get('id')} vehicle_id={vehicle_id} "
            f"row_garage_id={row_garage_id!r} vehicle_en_garage={candidate_vehicle is not None}"
        )
        if not candidate_vehicle:
            continue
        if row_garage_id and row_garage_id != garage_id:
            continue
        if row.get("used_at"):
            continue
        expires_at_dt = parse_datetime(row.get("expires_at"))
        if expires_at_dt and expires_at_dt <= now:
            continue
        access_code_row = row
        vehicle = candidate_vehicle
        break

    if not access_code_row:
        return jsonify({"success": False, "error": "Codigo invalido, vencido o ya utilizado"}), 400

    vehicle_id = str(access_code_row.get("vehicle_id") or "")
    print(f"[DEBUG validate] vehicle_id={vehicle_id}, vehicle encontrado={vehicle is not None}")

    if not vehicle:
        return jsonify({"success": False, "error": "Vehiculo asociado no disponible en este garage"}), 404

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
        ACCESS_CODES_TABLE,
        payload={"used_at": utcnow_iso()},
        filters=[{"column": "id", "value": access_code_row.get("id"), "optional": False}],
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
