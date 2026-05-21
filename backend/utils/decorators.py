from __future__ import annotations

from functools import wraps

from flask import g, jsonify, request

from utils.jwt_utils import extract_bearer_token, verify_jwt_token
from utils.supabase_client import (
    create_access_alert,
    ensure_auth_user_metadata,
    ensure_user_profile,
    get_client_ip,
    get_user_display_name,
    get_user_email,
    get_user_garage_id,
    get_user_role,
    log_auth_event,
    normalize_text,
)


def auth_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return ("", 204)

        token = extract_bearer_token(request)
        if not token:
            create_access_alert(
                email=None,
                route=request.path,
                reason="Falta header Authorization: Bearer <token>",
                alert_type="acceso_denegado",
            )
            log_auth_event(
                event="missing_token",
                success=False,
                email=None,
                garage_id=None,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"route": request.path},
            )
            return jsonify({"success": False, "error": "Token requerido"}), 401

        try:
            user = verify_jwt_token(token)
        except RuntimeError as exc:
            log_auth_event(
                event="auth_backend_unavailable",
                success=False,
                email=None,
                garage_id=None,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"route": request.path, "error": str(exc)},
            )
            return jsonify({"success": False, "error": "Servicio de autenticacion no disponible"}), 503
        except Exception as exc:
            create_access_alert(
                email=None,
                route=request.path,
                reason=str(exc),
                alert_type="acceso_denegado",
            )
            log_auth_event(
                event="invalid_token",
                success=False,
                email=None,
                garage_id=None,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"route": request.path, "error": str(exc)},
            )
            return jsonify({"success": False, "error": "Token inválido o expirado"}), 401

        user_id = str(getattr(user, "id", "") or "")
        email = get_user_email(user)
        garage_id = get_user_garage_id(user)
        role = get_user_role(user)
        name = get_user_display_name(user)

        ensure_auth_user_metadata(
            user_id=user_id,
            email=email,
            name=name,
            garage_id=garage_id,
            role=role,
        )
        ensure_user_profile(user, garage_id=garage_id, name=name, role=role)

        requested_garage = (
            kwargs.get("garage_id")
            or kwargs.get("garageId")
            or request.headers.get("X-Garage-ID")
            or request.args.get("garage_id")
            or request.args.get("garageId")
        )
        if not requested_garage:
            payload = request.get_json(silent=True) or {}
            requested_garage = payload.get("garage_id") or payload.get("garageId")

        if requested_garage and normalize_text(requested_garage) != normalize_text(garage_id):
            create_access_alert(
                user_id=user_id,
                email=email,
                garage_id=garage_id,
                role=role,
                route=request.path,
                reason=f"Intento de acceso al garage {requested_garage}",
                alert_type="acceso_denegado",
            )
            log_auth_event(
                event="garage_access_denied",
                success=False,
                user_id=user_id,
                email=email,
                garage_id=garage_id,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"requested_garage_id": requested_garage, "route": request.path},
            )
            return jsonify({"success": False, "error": "No autorizado para ese garage"}), 403

        g.jwt_token = token
        g.current_user = user
        g.current_user_id = user_id
        g.current_user_email = email
        g.current_user_name = name
        g.current_user_role = role
        g.current_user_garage_id = garage_id

        # Override garage_id if X-Garage-ID header is present
        header_garage = request.headers.get("X-Garage-ID")
        if header_garage:
            g.current_user_garage_id = str(header_garage).strip()

        return view_func(*args, **kwargs)

    return wrapper
