from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services import ReservationService
from utils.decorators import auth_required
from utils.supabase_client import normalize_text, parse_datetime
from utils.validators import normalize_plate, validate_plate


reservas_bp = Blueprint("reservas", __name__, url_prefix="/api/reservas")
service = ReservationService()


@reservas_bp.post("/crear")
@auth_required
def create_reservation():
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id") or g.current_user_id or "").strip()
    placa = normalize_plate(payload.get("placa")) if payload.get("placa") else None
    if placa and not validate_plate(placa):
        return jsonify({"success": False, "error": "La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"}), 400
    try:
        reservation = service.create_reservation(
            garage_id=g.current_user_garage_id,
            user_id=user_id,
            fecha_entrada=str(payload.get("fecha_entrada") or "").strip(),
            fecha_salida=str(payload.get("fecha_salida") or "").strip(),
            espacio_id=str(payload.get("espacio_id") or "").strip(),
            vehicle_id=str(payload.get("vehicle_id") or "").strip() or None,
            placa=placa,
        )
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    return jsonify({"success": True, "message": "Reserva creada correctamente", "data": reservation}), 201


@reservas_bp.get("/user/<user_id>")
@auth_required
def list_user_reservations(user_id: str):
    if normalize_text(g.current_user_role) != "admin" and normalize_text(user_id) != normalize_text(g.current_user_id):
        return jsonify({"success": False, "error": "No autorizado para consultar estas reservas"}), 403

    reservations = service.list_user_reservations(garage_id=g.current_user_garage_id, user_id=user_id)
    return jsonify({"success": True, "data": reservations})


@reservas_bp.get("/disponibles")
@auth_required
def list_available_spaces_for_reservations():
    start_dt = parse_datetime(request.args.get("fecha_entrada"))
    end_dt = parse_datetime(request.args.get("fecha_salida"))
    if not start_dt or not end_dt:
        return jsonify({"success": False, "error": "fecha_entrada y fecha_salida son requeridas"}), 400

    spaces = service.list_available_spaces(
        garage_id=g.current_user_garage_id,
        start_dt=start_dt,
        end_dt=end_dt,
    )
    return jsonify({"success": True, "data": spaces})


@reservas_bp.post("/<reservation_id>/cancelar")
@auth_required
def cancel_reservation(reservation_id: str):
    reservation = service.cancel_reservation(
        garage_id=g.current_user_garage_id,
        reservation_id=reservation_id,
        user_id=g.current_user_id,
        is_admin=normalize_text(g.current_user_role) == "admin",
    )
    if not reservation:
        return jsonify({"success": False, "error": "Reserva no encontrada"}), 404
    return jsonify({"success": True, "message": "Reserva cancelada correctamente", "data": reservation})


@reservas_bp.post("/<reservation_id>/convertir-entrada")
@auth_required
def convert_reservation_to_entry(reservation_id: str):
    try:
        payload = service.convert_to_entry(
            garage_id=g.current_user_garage_id,
            reservation_id=reservation_id,
        )
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    if not payload:
        return jsonify({"success": False, "error": "Reserva no encontrada"}), 404
    return jsonify({"success": True, "message": "Reserva convertida en entrada", "data": payload})
