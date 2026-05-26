from __future__ import annotations

from flask import g, jsonify, request

from services import ParkingService
from utils.pagination import get_pagination_params, paginate_items
from utils.supabase_client import normalize_text
from utils.validators import normalize_plate, validate_plate


class ParkingController:
    def __init__(self) -> None:
        self.parking_service = ParkingService()

    def entry(self):
        payload = request.get_json(silent=True) or {}
        placa = normalize_plate(payload.get("placa") or payload.get("plate"))
        if not placa:
            return jsonify({"success": False, "error": "placa es requerida"}), 400
        if not validate_plate(placa):
            return jsonify({"success": False, "error": "La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"}), 400

        try:
            result = self.parking_service.register_entry(
                garage_id=g.current_user_garage_id,
                usuario_id=g.current_user_id,
                usuario_nombre=g.current_user_name,
                placa=placa,
                espacio_id=payload.get("espacio_id") or payload.get("space_id"),
                propietario=(
                    payload.get("propietario")
                    or payload.get("owner_name")
                    or payload.get("conductor")
                    or payload.get("driverName")
                    or payload.get("driver_name")
                ),
                modelo=payload.get("modelo") or payload.get("model"),
                marca=payload.get("marca") or payload.get("brand"),
                tipo=payload.get("tipo") or payload.get("type") or payload.get("tipo_vehiculo") or payload.get("vehicleType"),
                color=payload.get("color"),
            )
            return jsonify(
                {
                    "success": True,
                    "data": result.get("session"),
                    "space": result.get("space"),
                    "duration": 0,
                    "message": result.get("message") or "Entrada registrada correctamente",
                    "session": result.get("session"),
                }
            ), 201
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 409
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc) or "No fue posible registrar la entrada"}), 500

    def exit(self):
        payload = request.get_json(silent=True) or {}
        placa = str(payload.get("placa") or payload.get("plate") or "").strip().upper()
        payment_method = str(payload.get("payment_method") or payload.get("metodo") or "").strip().lower()
        payment_reference = str(payload.get("payment_reference") or payload.get("referencia") or payload.get("reference") or "").strip()
        if not placa:
            return jsonify({"success": False, "error": "placa es requerida"}), 400

        try:
            result = self.parking_service.register_exit(
                garage_id=g.current_user_garage_id,
                placa=placa,
                payment_method=payment_method,
                payment_reference=payment_reference,
            )
            return jsonify(
                {
                    "success": True,
                    "duration_minutes": result.get("duration_minutes", 0),
                    "amount_to_pay": result.get("amount_to_pay", 0),
                    "message": result.get("message") or "Salida registrada correctamente",
                    "session": result.get("session"),
                }
            )
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 404
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc) or "No fue posible registrar la salida"}), 500

    def list_spaces(self):
        floor = str((request.view_args or {}).get("floor") or request.args.get("floor") or "").strip()
        spaces = self.parking_service.list_spaces(
            garage_id=g.current_user_garage_id,
            floor=floor or None,
            only_available=request.args.get("available", "").strip().lower() in {"1", "true", "si", "yes"},
        )
        return jsonify({"success": True, "data": spaces})

    def create_space(self):
        payload = request.get_json(silent=True) or {}
        code = str(payload.get("codigo") or payload.get("numero") or payload.get("nombre") or "").strip()
        floor = str(payload.get("piso") or payload.get("nivel") or payload.get("tipo") or "").strip()
        status_value = normalize_text(payload.get("status") or payload.get("estado") or "disponible")
        occupied = status_value in {"ocupado", "occupied", "busy"}

        if not code:
            return jsonify({"success": False, "error": "El numero o nombre del espacio es requerido"}), 400

        created = self.parking_service.space_repository.create(
            {
                "garage_id": g.current_user_garage_id,
                "numero": code,
                "codigo": code,
                "nombre": code,
                "piso": floor or None,
                "nivel": floor or None,
                "tipo": floor or None,
                "tipo_espacio": payload.get("tipo_espacio") or "regular",
                "ocupado": occupied,
                "occupied": occupied,
                "estado": "ocupado" if occupied else "disponible",
                "status": "occupied" if occupied else "available",
            }
        )
        return jsonify({"success": True, "message": "Espacio creado", "data": created}), 201

    def get_stats(self):
        return jsonify({"success": True, "data": self.parking_service.get_space_stats(garage_id=g.current_user_garage_id)})

    def update_space(self, space_id: str):
        payload = request.get_json(silent=True) or {}
        current_space = self.parking_service.space_repository.get_by_id_in_garage(space_id, g.current_user_garage_id)
        if not current_space:
            return jsonify({"success": False, "error": "Espacio no encontrado"}), 404

        next_status = normalize_text(payload.get("status") or payload.get("estado") or current_space.get("status") or current_space.get("estado"))
        occupied = next_status in {"ocupado", "occupied", "busy"}
        code = str(payload.get("codigo") or payload.get("numero") or payload.get("nombre") or current_space.get("codigo") or current_space.get("numero") or "").strip()
        floor = str(payload.get("piso") or payload.get("nivel") or payload.get("tipo") or current_space.get("piso") or current_space.get("nivel") or "").strip()

        if not code:
            return jsonify({"success": False, "error": "El numero o nombre del espacio es requerido"}), 400

        updated = self.parking_service.space_repository.update_in_garage(
            record_id=space_id,
            garage_id=g.current_user_garage_id,
            payload={
                "numero": code,
                "codigo": code,
                "nombre": code,
                "piso": floor or None,
                "nivel": floor or None,
                "tipo": floor or None,
                "ocupado": occupied,
                "occupied": occupied,
                "estado": "ocupado" if occupied else "disponible",
                "status": "occupied" if occupied else "available",
            },
        )
        if not updated:
            return jsonify({"success": False, "error": "Espacio no encontrado"}), 404
        return jsonify({"success": True, "message": "Espacio actualizado", "data": updated})

    def delete_space(self, space_id: str):
        current_space = self.parking_service.space_repository.get_by_id_in_garage(space_id, g.current_user_garage_id)
        if not current_space:
            return jsonify({"success": False, "error": "Espacio no encontrado"}), 404
        if current_space.get("ocupado") or current_space.get("occupied") or normalize_text(current_space.get("estado")) == "ocupado":
            return jsonify({"success": False, "error": "No puedes eliminar un espacio ocupado"}), 400

        deleted = self.parking_service.space_repository.delete_in_garage(space_id, g.current_user_garage_id)
        if not deleted:
            return jsonify({"success": False, "error": "No fue posible eliminar el espacio"}), 500
        return jsonify({"success": True, "message": "Espacio eliminado", "data": {"id": space_id}})

    def active_sessions(self):
        rows = self.parking_service.get_active_sessions(garage_id=g.current_user_garage_id)
        pagination = get_pagination_params()
        if not pagination["enabled"]:
            return jsonify({"success": True, "data": rows})
        page_rows, meta = paginate_items(rows, page=pagination["page"], page_size=pagination["page_size"])
        return jsonify({"success": True, "data": page_rows, "meta": meta})

    def list_sessions(self):
        rows = self.parking_service.list_sessions(garage_id=g.current_user_garage_id)
        pagination = get_pagination_params()
        if not pagination["enabled"]:
            return jsonify({"success": True, "data": rows})
        page_rows, meta = paginate_items(rows, page=pagination["page"], page_size=pagination["page_size"])
        return jsonify({"success": True, "data": page_rows, "meta": meta})
