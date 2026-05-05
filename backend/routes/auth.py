from __future__ import annotations

from flask import Blueprint, g, jsonify

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


@auth_bp.get("/verify")
@auth_required
def verify():
    return controller.verify()


@auth_bp.post("/logout")
@auth_required
def logout():
    return controller.logout()


# ✅ RUTA /api/auth/me - Devuelve el usuario actual DIRECTAMENTE
@auth_bp.get("/me")
@auth_required
def me():
    return jsonify({
        "id": g.current_user_id,
        "email": g.current_user_email,
        "name": g.current_user_name,
        "role": g.current_user_role,
        "garage_id": g.current_user_garage_id,
    })


@auth_bp.post('/verify-otp')
def verify_otp():
    from flask import request as req
    payload = req.get_json(silent=True) or {}
    email = str(payload.get('email') or '').strip().lower()
    code = str(payload.get('code') or '').strip()
    if not email or not code:
        return jsonify({'success': False, 'error': 'email y code son requeridos'}), 400
    try:
        from services.otp_service import OTPService
        otp_service = OTPService()
        valid = otp_service.verify(email=email, code=code)
        if valid:
            return jsonify({'success': True, 'message': 'Cuenta verificada correctamente'})
        return jsonify({'success': False, 'error': 'Código incorrecto o expirado'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@auth_bp.post('/resend-otp')
def resend_otp():
    from flask import request as req
    payload = req.get_json(silent=True) or {}
    email = str(payload.get('email') or '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'email es requerido'}), 400
    try:
        from utils.supabase_client import get_user_table_client
        client = get_user_table_client(use_admin=True)
        user_resp = client.from_('users').select('id').eq('email', email).maybe_single().execute()
        user_data = getattr(user_resp, 'data', None)
        if not user_data:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        from services.otp_service import OTPService
        OTPService().generate_and_send(user_id=user_data['id'], email=email)
        return jsonify({'success': True, 'message': 'Código reenviado'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
