from __future__ import annotations

from flask import g, jsonify, request

from services import ParkingService
from utils.pagination import get_pagination_params, paginate_items
from utils.supabase_client import normalize_text


class ParkingController:
    def __init__(self) -> None:
        self.parking_service = ParkingService()

    def entry(self):
        payload = request.get_json(silent=True) or {}
        placa = str(payload.get("placa") or payload.get("plate") or "").strip().upper()
        if not placa:
            return jsonify({"success": False, "error": "placa es requerida"}), 400

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

    def get_stats(self):
        return jsonify({"success": True, "data": self.parking_service.get_space_stats(garage_id=g.current_user_garage_id)})

    def update_space(self, space_id: str):
        payload = request.get_json(silent=True) or {}
        next_status = normalize_text(payload.get("status") or payload.get("estado"))
        if next_status not in {"occupied", "available"}:
            return jsonify({"success": False, "error": "status debe ser occupied o available"}), 400

        updated = self.parking_service.update_space_status(
            garage_id=g.current_user_garage_id,
            space_id=space_id,
            status=next_status,
        )
        if not updated:
            return jsonify({"success": False, "error": "Espacio no encontrado"}), 404
        return jsonify({"success": True, "message": "Espacio actualizado", "data": updated})

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
