from __future__ import annotations

import traceback

from flask import g, jsonify, request

from services import AuthService
from utils.jwt_utils import generate_jwt_token
from utils.supabase_client import create_access_alert, get_client_ip, log_auth_event


class AuthController:
    def __init__(self) -> None:
        self.auth_service = AuthService()

    def login(self):
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")

        if not email or not password:
            return jsonify({"success": False, "error": "email y password son requeridos"}), 400

        try:
            result = self.auth_service.login(email=email, password=password, request=request)

            # âœ… FIX #1: Extraer los datos del usuario
            user = result.get("user", {})
            user_id = user.get("id")

            # âœ… FIX #2: Generar JWT token si no existe
            token = result.get("token") or result.get("access_token")

            if not token and user_id:
                # Si el servicio no devolviÃ³ token, lo generamos aquÃ­
                token = generate_jwt_token({
                    "sub": user_id,
                    "email": email,
                    "user_id": user_id,
                })

            # âœ… FIX #3: Retornar estructura correcta que el frontend espera
            return jsonify({
                "success": True,
                "message": "Login exitoso",
                "token": token,  # â† CRÃTICO: El frontend busca "token"
                "user": {
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "role": user.get("role"),
                    "garage_id": user.get("garage_id"),
                    "company_name": user.get("company_name"),
                    "company_address": user.get("company_address"),
                    "company_phone": user.get("company_phone"),
                }
            }), 200

        except Exception as exc:
            # â”€â”€ Log completo en consola para diagnostico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            print("\n" + "=" * 60)
            print(f"[AUTH] LOGIN FAILED â€” {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")

            # â”€â”€ Clasificar el error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            error_msg = str(exc).lower()

            is_bad_credentials = any(p in error_msg for p in [
                "invalid login credentials",
                "invalid email or password",
                "email not confirmed",
                "user not found",
            ])

            is_config_error = any(p in error_msg for p in [
                "supabase_url",
                "supabase_key",
                "configura",
                "no fue posible conectar",
                "connection",
                "timeout",
            ])

            # â”€â”€ Log en Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            try:
                log_auth_event(
                    event="login",
                    success=False,
                    email=email,
                    garage_id=None,
                    ip_address=get_client_ip(request),
                    user_agent=request.headers.get("User-Agent"),
                    details={"error": str(exc), "type": type(exc).__name__},
                )
            except Exception:
                pass

            try:
                create_access_alert(
                    email=email,
                    route="/api/auth/login",
                    reason=str(exc),
                    alert_type="login_fallido",
                )
            except Exception:
                pass

            try:
                from utils.supabase_client import get_user_table_client
                admin_client = get_user_table_client(use_admin=True)
                admin_client.from_("alertas_acceso").insert({
                    "email": email,
                    "tipo": "login_fallido",
                    "tipo_alerta": "login_fallido",
                    "reason": str(exc),
                    "route": "/api/auth/login",
                    "estado": "pendiente",
                }).execute()
            except Exception:
                pass

            # â”€â”€ Respuesta al cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if is_bad_credentials:
                return jsonify({
                    "success": False,
                    "error": "Correo o contraseÃ±a incorrectos.",
                }), 401

            if is_config_error:
                return jsonify({
                    "success": False,
                    "error": "Error de configuraciÃ³n del servidor. Contacta al administrador.",
                }), 500

            # Cualquier otro error â€” devuelve el mensaje real para debug
            return jsonify({
                "success": False,
                "error": f"Error inesperado: {str(exc)}",
                "type": type(exc).__name__,
            }), 500

    def register(self):
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("name") or "").strip()
        company_name = str(payload.get("company_name") or payload.get("empresa") or "").strip()
        company_address = str(payload.get("company_address") or payload.get("direccion") or "").strip()
        company_phone = str(payload.get("company_phone") or payload.get("telefonoEmpresa") or "").strip()
        role = str(payload.get("role") or "admin").strip().lower()
        garage_id = str(payload.get("garage_id") or "").strip() or None
        parking_spaces_count = payload.get("parking_spaces_count") or payload.get("cupos_totales") or 20

        if not email or not password or not name:
            return jsonify({"success": False, "error": "email, password y name son requeridos"}), 400

        if not garage_id and not company_name:
            return jsonify({"success": False, "error": "El nombre de la empresa es requerido"}), 400

        if len(password) < 6:
            return jsonify({"success": False, "error": "La contraseÃ±a debe tener al menos 6 caracteres"}), 400

        try:
            parking_spaces_count = max(1, min(int(parking_spaces_count), 300))
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "Los cupos iniciales deben ser un numero valido"}), 400

        try:
            result = self.auth_service.register(
                email=email,
                password=password,
                name=name,
                role=role,
                garage_id=garage_id,
                company_name=company_name,
                company_address=company_address,
                company_phone=company_phone,
                parking_spaces_count=parking_spaces_count,
                request=request,
            )
            return jsonify({"success": True, "message": "Usuario creado correctamente", **result}), 201

        except Exception as exc:
            print("\n" + "=" * 60)
            print(f"[AUTH] REGISTER FAILED â€” {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")

            return jsonify({
                "success": False,
                "error": str(exc) or "No fue posible crear el usuario",
                "type": type(exc).__name__,
            }), 500

    def verify(self):
        # âœ… FIX: Devolver el usuario DIRECTAMENTE, no dentro de "user"
        return jsonify({
            "id": g.current_user_id,
            "email": g.current_user_email,
            "name": g.current_user_name,
            "role": g.current_user_role,
            "garage_id": g.current_user_garage_id,
        })

    def logout(self):
        try:
            log_auth_event(
                event="logout",
                success=True,
                user_id=g.current_user_id,
                email=g.current_user_email,
                garage_id=g.current_user_garage_id,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
            )
        except Exception:
            pass

        return jsonify(
            {
                "success": True,
                "message": "Logout registrado. El cliente debe descartar el JWT.",
            }
        )
