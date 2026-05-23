from __future__ import annotations

import json
import re
from urllib.parse import parse_qs, urlparse

from flask import Blueprint, g, jsonify, request

from services import ParkingService
from utils.decorators import auth_required
from utils.supabase_client import normalize_text, parse_datetime, select_rows, update_rows, utcnow_iso, utcnow


qr_access_bp = Blueprint("qr_access", __name__, url_prefix="/api/qr-access")
parking_service = ParkingService()
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


def _vehicle_payload(vehicle: dict | None) -> dict:
    vehicle = vehicle or {}
    return {
        "id": vehicle.get("id"),
        "placa": str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
        "plate": str(vehicle.get("placa") or vehicle.get("plate") or "").strip().upper(),
        "propietario": vehicle.get("propietario") or vehicle.get("owner_name") or vehicle.get("owner") or "",
        "owner_name": vehicle.get("owner_name") or vehicle.get("propietario") or vehicle.get("owner") or "",
        "modelo": vehicle.get("modelo") or vehicle.get("model") or "",
        "model": vehicle.get("model") or vehicle.get("modelo") or "",
        "marca": vehicle.get("marca") or vehicle.get("brand") or "",
        "brand": vehicle.get("brand") or vehicle.get("marca") or "",
        "color": vehicle.get("color") or "",
    }


def _vehicle_matches_code(vehicle: dict, access_code: str) -> bool:
    wanted = normalize_text(access_code)
    for key in ("placa", "plate", "codigo", "code", "access_code", "qr_code", "codigo_acceso"):
        if normalize_text(vehicle.get(key)) == wanted:
            return True
    return False


def _extract_code_from_text(raw_value: str) -> str:
    text = str(raw_value or "").strip()
    if not text:
        return ""

    try:
        parsed_json = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        parsed_json = None

    if isinstance(parsed_json, dict):
        for key in ("code", "access_code", "codigo", "codigo_acceso", "qr_data", "value"):
            candidate = _extract_code_from_text(parsed_json.get(key))
            if candidate:
                return candidate

    parsed_url = urlparse(text)
    if parsed_url.scheme and parsed_url.netloc:
        params = parse_qs(parsed_url.query)
        for key in ("code", "access_code", "codigo", "codigo_acceso"):
            if params.get(key):
                candidate = _extract_code_from_text(params[key][0])
                if candidate:
                    return candidate

    regex_patterns = (
        r"(?:code|access_code|codigo|codigo_acceso)\s*[:=]\s*([A-Z0-9-]{3,64})",
        r"\b([0-9]{6})\b",
    )
    upper_text = text.upper()
    for pattern in regex_patterns:
        match = re.search(pattern, upper_text, re.IGNORECASE)
        if match:
            return match.group(1).strip().upper()

    compact = re.sub(r"\s+", "", upper_text)
    if re.fullmatch(r"[A-Z0-9-]{3,64}", compact):
        return compact

    return upper_text


def _extract_access_code(payload: dict) -> str:
    for key in ("code", "qr_data"):
        candidate = _extract_code_from_text(payload.get(key) or "")
        if candidate:
            return candidate
    return ""


def _build_denied_response(message: str, code: str = ""):
    return (
        jsonify(
            {
                "success": True,
                "valid": False,
                "access": "denied",
                "code": code,
                "message": message,
                "vehicle": None,
            }
        ),
        200,
    )


@qr_access_bp.post("/verify")
@auth_required
def verify_qr_access():
    payload = request.get_json(silent=True) or {}
    access_code = _extract_access_code(payload)

    if not access_code:
        return jsonify({"success": False, "error": "Debes enviar code o qr_data"}), 400

    vehicles_by_id = _load_garage_vehicles()
    active_sessions = parking_service.get_active_sessions(garage_id=g.current_user_garage_id)
    active_by_vehicle_id = {
        str(session.get("vehicle_id") or session.get("vehiculo_id") or ""): session
        for session in active_sessions
        if session.get("vehicle_id") or session.get("vehiculo_id")
    }
    active_by_plate = {
        normalize_text(session.get("plate") or session.get("placa")): session
        for session in active_sessions
        if session.get("plate") or session.get("placa")
    }

    code_rows = select_rows(
        ACCESS_CODES_TABLE,
        filters=[{"column": "code", "value": access_code, "optional": False}],
        order_candidates=["created_at"],
        desc=True,
        limit=20,
    )

    now = utcnow()
    selected_code = None
    selected_vehicle = None
    selected_active_session = None

    for row in code_rows:
        expires_at_dt = parse_datetime(row.get("expires_at"))
        if expires_at_dt and expires_at_dt <= now:
            continue

        row_garage_id = str(row.get("garage_id") or "").strip()
        if row_garage_id and normalize_text(row_garage_id) != normalize_text(g.current_user_garage_id):
            continue

        vehicle = vehicles_by_id.get(str(row.get("vehicle_id") or ""))
        if not vehicle:
            continue

        active_session = active_by_vehicle_id.get(str(vehicle.get("id") or ""))
        if not active_session:
            active_session = active_by_plate.get(normalize_text(vehicle.get("placa") or vehicle.get("plate")))

        if row.get("used_at") and not active_session:
            continue

        selected_code = row
        selected_vehicle = vehicle
        selected_active_session = active_session
        break

    if not selected_vehicle:
        for vehicle in vehicles_by_id.values():
            if not _vehicle_matches_code(vehicle, access_code):
                continue

            selected_vehicle = vehicle
            selected_active_session = active_by_vehicle_id.get(str(vehicle.get("id") or ""))
            if not selected_active_session:
                selected_active_session = active_by_plate.get(normalize_text(vehicle.get("placa") or vehicle.get("plate")))
            break

    if not selected_vehicle:
        return _build_denied_response("Codigo o QR invalido para este garage.", access_code)

    vehicle_payload = _vehicle_payload(selected_vehicle)
    movement = "exit" if selected_active_session else "entry"

    try:
        if movement == "exit":
            result = parking_service.register_exit(
                garage_id=g.current_user_garage_id,
                placa=vehicle_payload["placa"],
                payment_method="qr_access",
                payment_reference=access_code,
            )
            if selected_code:
                update_rows(
                    ACCESS_CODES_TABLE,
                    payload={"used_at": utcnow_iso()},
                    filters=[{"column": "id", "value": selected_code.get("id"), "optional": False}],
                )
            space_payload = (
                {
                    "id": selected_active_session.get("space_id") or selected_active_session.get("espacio_id"),
                    "codigo": selected_active_session.get("space_code") or selected_active_session.get("espacio") or "",
                    "numero_mostrar": selected_active_session.get("space_code") or selected_active_session.get("espacio") or "",
                }
                if selected_active_session
                else None
            )
            message = "Salida registrada. Acceso autorizado."
        else:
            result = parking_service.register_entry(
                garage_id=g.current_user_garage_id,
                usuario_id=g.current_user_id,
                usuario_nombre=g.current_user_name,
                placa=vehicle_payload["placa"],
                espacio_id=selected_vehicle.get("space_id") or selected_vehicle.get("espacio_id"),
                propietario=vehicle_payload["propietario"],
                modelo=vehicle_payload["modelo"],
                marca=vehicle_payload["marca"],
                tipo=selected_vehicle.get("tipo") or selected_vehicle.get("type"),
                color=vehicle_payload["color"],
            )
            space_payload = result.get("space")
            message = "Entrada registrada. Acceso autorizado."
            if selected_code:
                update_rows(
                    ACCESS_CODES_TABLE,
                    payload={"used_at": utcnow_iso()},
                    filters=[{"column": "id", "value": selected_code.get("id"), "optional": False}],
                )
    except ValueError as exc:
        return _build_denied_response(str(exc), access_code)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc) or "No fue posible verificar el acceso"}), 500

    return (
        jsonify(
            {
                "success": True,
                "valid": True,
                "access": "granted",
                "movement": movement,
                "code": access_code,
                "message": message,
                "vehicle": vehicle_payload,
                "space": space_payload,
                "session": result.get("session"),
            }
        ),
        200,
    )
