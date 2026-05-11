from __future__ import annotations

from flask import g, jsonify, request

from services import AuthService, UserService
from utils.supabase_client import normalize_text


class UserController:
    def __init__(self) -> None:
        self.auth_service = AuthService()
        self.user_service = UserService()

    def list(self):
        users = self.user_service.list_users(garage_id=g.current_user_garage_id)
        return jsonify({"success": True, "data": users})

    def create(self):
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("nombre") or payload.get("name") or "").strip()
        role = str(payload.get("rol") or payload.get("role") or "usuario").strip().lower()

        if not email or not password or not name:
            return jsonify({"success": False, "error": "email, password y nombre son requeridos"}), 400

        if self.user_service.get_user(email=email):
            return jsonify({"success": False, "error": "Ya existe un usuario con ese email"}), 409

        try:
            result = self.auth_service.register(
                email=email,
                password=password,
                name=name,
                role=role,
                garage_id=g.current_user_garage_id,
                request=request,
            )
            return jsonify({"success": True, "message": "Usuario creado correctamente", **result}), 201
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc) or "No fue posible crear el usuario"}), 500

    def update(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        current = self.user_service.get_user(user_id=user_id)
        if not current:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

        if normalize_text(current.get("garage_id")) != normalize_text(g.current_user_garage_id):
            return jsonify({"success": False, "error": "No autorizado para modificar ese usuario"}), 403

        mapped_payload = {
            "nombre": payload.get("nombre") or payload.get("name"),
            "rol": payload.get("rol") or payload.get("role"),
            "garage_id": payload.get("garage_id") or current.get("garage_id"),
            "email": payload.get("email") or current.get("email"),
        }
        cleaned = {key: value for key, value in mapped_payload.items() if value is not None}
        updated = self.user_service.update_user(user_id=user_id, payload=cleaned)
        if not updated:
            return jsonify({"success": False, "error": "No fue posible actualizar el usuario"}), 500
        return jsonify({"success": True, "message": "Usuario actualizado", "data": updated})

    def delete(self, user_id: str):
        current = self.user_service.get_user(user_id=user_id)
        if not current:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

        if normalize_text(current.get("garage_id")) != normalize_text(g.current_user_garage_id):
            return jsonify({"success": False, "error": "No autorizado para eliminar ese usuario"}), 403

        deleted = self.user_service.delete_user(user_id=user_id)
        if not deleted:
            return jsonify({"success": False, "error": "No fue posible eliminar el usuario"}), 500
        return jsonify({"success": True, "message": "Usuario eliminado"})

    def list_pending_personnel(self):
        if normalize_text(g.current_user_role) != "admin":
            return jsonify({"success": False, "error": "Solo un administrador puede revisar solicitudes"}), 403

        pending = self.user_service.list_pending_personnel(garage_id=g.current_user_garage_id)
        return jsonify({"success": True, "data": pending})

    def approve_personnel(self, request_id: str):
        if normalize_text(g.current_user_role) != "admin":
            return jsonify({"success": False, "error": "Solo un administrador puede aprobar personal"}), 403

        approved = self.user_service.approve_personnel_request(
            garage_id=g.current_user_garage_id,
            request_id=request_id,
        )
        if not approved:
            return jsonify({"success": False, "error": "Solicitud no encontrada"}), 404
        return jsonify({"success": True, "message": "Personal aprobado correctamente", "data": approved})
