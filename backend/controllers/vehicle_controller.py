from __future__ import annotations

from flask import g, jsonify, request

from services import VehicleService
from utils.supabase_client import normalize_text, row_belongs_to_user
from utils.validators import normalize_plate, validate_plate


class VehicleController:
    def __init__(self) -> None:
        self.vehicle_service = VehicleService()

    def list(self):
        only_mine = request.args.get("mine", "").strip().lower() in {"1", "true", "si", "yes"}
        vehicles = self.vehicle_service.list_vehicles(
            garage_id=g.current_user_garage_id,
            propietario_id=g.current_user_id if only_mine else None,
        )
        return jsonify({"success": True, "data": vehicles})

    def create(self):
        payload = request.get_json(silent=True) or {}
        placa = normalize_plate(payload.get("placa") or payload.get("plate"))
        marca = str(payload.get("marca") or payload.get("brand") or "").strip()
        modelo = str(payload.get("modelo") or payload.get("model") or "").strip()
        tipo = str(payload.get("tipo") or payload.get("type") or "").strip()
        color = str(payload.get("color") or "").strip()

        if not placa or not marca or not modelo:
            return jsonify({"success": False, "error": "placa, marca y modelo son requeridos"}), 400
        if not validate_plate(placa):
            return jsonify({"success": False, "error": "La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"}), 400

        existing = self.vehicle_service.get_vehicle(garage_id=g.current_user_garage_id, plate=placa)
        if existing:
            return jsonify({"success": False, "error": "Ya existe un vehiculo con esa placa"}), 409

        created = self.vehicle_service.register_vehicle(
            garage_id=g.current_user_garage_id,
            propietario_id=g.current_user_id,
            placa=placa,
            marca=marca,
            modelo=modelo,
            tipo=tipo,
            color=color,
            owner_name=g.current_user_name,
            owner_email=g.current_user_email,
        )
        return jsonify({"success": True, "message": "Vehiculo agregado", "data": created}), 201

    def update(self, vehicle_id: str):
        payload = request.get_json(silent=True) or {}
        current = self.vehicle_service.get_vehicle(vehicle_id=vehicle_id)
        if not current:
            return jsonify({"success": False, "error": "Vehiculo no encontrado"}), 404

        if normalize_text(current.get("garage_id")) != normalize_text(g.current_user_garage_id):
            return jsonify({"success": False, "error": "No autorizado para modificar ese vehiculo"}), 403

        if not row_belongs_to_user(current, g.current_user_id, g.current_user_email) and g.current_user_role not in {"admin", "administrador", "portero"}:
            return jsonify({"success": False, "error": "No autorizado para modificar ese vehiculo"}), 403

        cleaned = {
            "placa": normalize_plate(payload.get("placa") or payload.get("plate") or current.get("plate")),
            "marca": payload.get("marca") or payload.get("brand") or current.get("brand"),
            "modelo": payload.get("modelo") or payload.get("model") or current.get("model"),
            "tipo": payload.get("tipo") or payload.get("type") or current.get("type"),
            "color": payload.get("color") if "color" in payload else current.get("color"),
        }
        if not validate_plate(cleaned["placa"]):
            return jsonify({"success": False, "error": "La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"}), 400
        updated = self.vehicle_service.update_vehicle(vehicle_id=vehicle_id, payload=cleaned)
        if not updated:
            return jsonify({"success": False, "error": "No fue posible actualizar el vehiculo"}), 500
        return jsonify({"success": True, "message": "Vehiculo actualizado", "data": updated})

    def delete(self, vehicle_id: str):
        current = self.vehicle_service.get_vehicle(vehicle_id=vehicle_id)
        if not current:
            return jsonify({"success": False, "error": "Vehiculo no encontrado"}), 404

        if normalize_text(current.get("garage_id")) != normalize_text(g.current_user_garage_id):
            return jsonify({"success": False, "error": "No autorizado para eliminar ese vehiculo"}), 403

        deleted = self.vehicle_service.delete_vehicle(vehicle_id=vehicle_id)
        if not deleted:
            return jsonify({"success": False, "error": "No fue posible eliminar el vehiculo"}), 500
        return jsonify({"success": True, "message": "Vehiculo eliminado"})

    def search(self):
        term = normalize_text(request.args.get("q") or request.args.get("query") or "")
        vehicles = self.vehicle_service.search_vehicles(garage_id=g.current_user_garage_id, term=term)
        return jsonify({"success": True, "data": vehicles})
