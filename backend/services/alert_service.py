from __future__ import annotations

from flask import Request

from utils.supabase_client import create_access_alert, get_client_ip, log_auth_event


class AlertService:
    def create_alert(
        self,
        *,
        garage_id: str | None,
        descripcion: str,
        tipo_alerta: str = "acceso_denegado",
        estado: str = "pendiente",
        user_id: str | None = None,
        email: str | None = None,
        role: str | None = None,
        route: str | None = None,
    ) -> None:
        create_access_alert(
            user_id=user_id,
            email=email,
            garage_id=garage_id,
            role=role,
            route=route,
            reason=descripcion,
            alert_type=tipo_alerta,
        )

    def log_access_attempt(
        self,
        *,
        event: str,
        success: bool,
        request: Request,
        user_id: str | None = None,
        email: str | None = None,
        garage_id: str | None = None,
        details: dict | None = None,
    ) -> None:
        log_auth_event(
            event=event,
            success=success,
            user_id=user_id,
            email=email,
            garage_id=garage_id,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            details=details or {},
        )
