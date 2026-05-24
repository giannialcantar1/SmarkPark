from __future__ import annotations

from flask import Blueprint, jsonify

from controllers import AuthController
from utils.decorators import auth_required


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
controller = AuthController()


@auth_bp.post("/login")
def login():
    return controller.login()


@auth_bp.post("/register")
def register():
    return controller.register()


@auth_bp.post("/staff-register")
def staff_register():
    return controller.staff_register()


@auth_bp.post("/visitor-register")
def visitor_register():
    return controller.visitor_register()


@auth_bp.get("/verify")
@auth_required
def verify():
    return controller.verify()


@auth_bp.post("/logout")
@auth_required
def logout():
    return controller.logout()


@auth_bp.get("/me")
@auth_required
def me():
    return controller.verify()


@auth_bp.post("/verify-otp")
def verify_otp():
    from flask import request as req

    payload = req.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    code = str(payload.get("code") or "").strip()
    if not email or not code:
        return jsonify({"success": False, "error": "email y code son requeridos"}), 400
    try:
        from services.otp_service import OTPService

        otp_service = OTPService()
        valid = otp_service.verify(email=email, code=code)
        if valid:
            return jsonify({"success": True, "message": "Cuenta verificada correctamente"})
        return jsonify({"success": False, "error": "Codigo incorrecto o expirado"}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@auth_bp.post("/resend-otp")
def resend_otp():
    from flask import request as req

    payload = req.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        return jsonify({"success": False, "error": "email es requerido"}), 400
    try:
        from services.otp_service import OTPService
        from utils.supabase_client import get_user_table_client

        client = get_user_table_client(use_admin=True)
        user_resp = client.from_("users").select("id").eq("email", email).maybe_single().execute()
        user_data = getattr(user_resp, "data", None)
        if not user_data:
            return jsonify({"success": False, "error": "Usuario no encontrado"}), 404
        OTPService().generate_and_send(user_id=user_data["id"], email=email)
        return jsonify({"success": True, "message": "Codigo reenviado"})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
