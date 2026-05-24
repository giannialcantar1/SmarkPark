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
            user = result.get("user", {})
            user_id = user.get("id")
            token = result.get("token") or result.get("access_token")
            refresh_token = result.get("refresh_token")

            if not token and user_id:
                token = generate_jwt_token({
                    "sub": user_id,
                    "email": email,
                    "user_id": user_id,
                })

            return jsonify({
                "success": True,
                "message": "Login exitoso",
                "token": token,
                "access_token": token,
                "refresh_token": refresh_token,
                "token_type": result.get("token_type") or "bearer",
                "expires_in": result.get("expires_in"),
                "user": {
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "role": user.get("role"),
                    "status": user.get("status"),
                    "approval_status": user.get("approval_status"),
                    "garage_id": user.get("garage_id"),
                    "company_name": user.get("company_name"),
                    "company_address": user.get("company_address"),
                    "company_phone": user.get("company_phone"),
                },
            }), 200

        except PermissionError as exc:
            return jsonify({
                "success": False,
                "error": str(exc),
                "status": "pendiente_aprobacion",
            }), 403
        except Exception as exc:
            print("\n" + "=" * 60)
            print(f"[AUTH] LOGIN FAILED - {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")

            error_msg = str(exc).lower()
            is_email_unconfirmed = "email not confirmed" in error_msg
            is_bad_credentials = any(token in error_msg for token in [
                "invalid login credentials",
                "invalid email or password",
                "user not found",
            ])
            is_config_error = any(token in error_msg for token in [
                "supabase_url",
                "supabase_key",
                "configura",
                "no fue posible conectar",
                "connection",
                "timeout",
            ])

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

            if is_email_unconfirmed:
                return jsonify({
                    "success": False,
                    "error": "Tu cuenta aun no ha sido verificada. Completa la verificacion e intenta nuevamente.",
                }), 403

            if is_bad_credentials:
                return jsonify({"success": False, "error": "Correo o contrasena incorrectos."}), 401

            if is_config_error:
                return jsonify({
                    "success": False,
                    "error": "Error de configuracion del servidor. Contacta al administrador.",
                }), 500

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
            return jsonify({"success": False, "error": "La contrasena debe tener al menos 6 caracteres"}), 400

        try:
            parking_spaces_count = int(parking_spaces_count)
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
            print(f"[AUTH] REGISTER FAILED - {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")
            return jsonify({
                "success": False,
                "error": str(exc) or "No fue posible crear el usuario",
                "type": type(exc).__name__,
            }), 500

    def staff_register(self):
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("name") or payload.get("full_name") or "").strip()
        role = str(payload.get("role") or "operador").strip().lower()
        garage_code = str(payload.get("garage_code") or payload.get("codigo_garaje") or "").strip()

        missing_fields = [
            field_name
            for field_name, value in {
                "email": email,
                "password": password,
                "name": name,
                "garage_code": garage_code,
            }.items()
            if not str(value or "").strip()
        ]
        if missing_fields:
            return jsonify({
                "success": False,
                "error": f"Faltan campos requeridos: {', '.join(missing_fields)}.",
                "code": "missing_required_fields",
            }), 400

        if len(password) < 6:
            return jsonify({
                "success": False,
                "error": "La contrasena debe tener al menos 6 caracteres.",
                "code": "weak_password",
            }), 400

        try:
            result = self.auth_service.register_staff(
                email=email,
                password=password,
                name=name,
                role=role,
                garage_code=garage_code,
                request=request,
            )
            return jsonify({
                "success": True,
                "message": "Solicitud enviada. Tu cuenta quedo pendiente de aprobacion.",
                **result,
            }), 201
        except ValueError as exc:
            error_code = getattr(exc, "code", "staff_register_validation_error")
            debug_context = getattr(exc, "debug_context", {})
            print("\n" + "=" * 60)
            print(f"[AUTH] STAFF REGISTER FAILED - {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Role: {role}")
            print(f"[AUTH] Garage code: {garage_code}")
            print(f"[AUTH] Error code: {error_code}")
            print(f"[AUTH] Error: {str(exc)}")
            if debug_context:
                print(f"[AUTH] Debug context: {debug_context}")
            print("=" * 60 + "\n")
            return jsonify({
                "success": False,
                "error": str(exc),
                "code": error_code,
            }), 400
        except Exception as exc:
            print("\n" + "=" * 60)
            print(f"[AUTH] STAFF REGISTER FAILED - {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Role: {role}")
            print(f"[AUTH] Garage code: {garage_code}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")
            return jsonify({
                "success": False,
                "error": str(exc) or "No fue posible registrar al personal",
                "type": type(exc).__name__,
                "code": "staff_register_unexpected_error",
            }), 500

    def visitor_register(self):
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("name") or payload.get("full_name") or "").strip()
        garage_id = str(payload.get("garage_id") or "").strip() or None

        if not email or not password or not name:
            return jsonify({"success": False, "error": "email, password y name son requeridos"}), 400

        if len(password) < 6:
            return jsonify({"success": False, "error": "La contrasena debe tener al menos 6 caracteres"}), 400

        try:
            result = self.auth_service.register_visitor(
                email=email,
                password=password,
                name=name,
                garage_id=garage_id,
                request=request,
            )
            return jsonify({
                "success": True,
                "message": "Usuario visitante creado correctamente",
                **result,
            }), 201
        except ValueError as exc:
            return jsonify({
                "success": False,
                "error": str(exc),
                "code": getattr(exc, "code", "visitor_register_validation_error"),
            }), 400
        except Exception as exc:
            print("\n" + "=" * 60)
            print(f"[AUTH] VISITOR REGISTER FAILED - {type(exc).__name__}")
            print(f"[AUTH] Email: {email}")
            print(f"[AUTH] Error: {str(exc)}")
            traceback.print_exc()
            print("=" * 60 + "\n")
            return jsonify({
                "success": False,
                "error": str(exc) or "No fue posible registrar el usuario visitante",
                "type": type(exc).__name__,
                "code": "visitor_register_unexpected_error",
            }), 500

    def verify(self):
        access_status = self.auth_service.user_service.get_access_status(
            user_id=g.current_user_id,
            email=g.current_user_email,
        )
        return jsonify({
            "id": g.current_user_id,
            "email": g.current_user_email,
            "name": g.current_user_name,
            "role": g.current_user_role,
            "garage_id": g.current_user_garage_id,
            "status": access_status,
            "approval_status": access_status,
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

        return jsonify({
            "success": True,
            "message": "Logout registrado. El cliente debe descartar el JWT.",
        })
