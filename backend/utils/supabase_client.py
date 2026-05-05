from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Callable

import httpx
from flask import Request
from postgrest.exceptions import APIError
from supabase.lib.client_options import SyncClientOptions
from supabase import Client, create_client

from config import Config


_auth_client: Client | None = None
_admin_client: Client | None = None


def _build_httpx_client(timeout: float) -> httpx.Client:
    return httpx.Client(
        http2=False,
        timeout=timeout,
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
    )


def _create_supabase_client(url: str, key: str) -> Client:
    return create_client(
        url,
        key,
        options=SyncClientOptions(
            httpx_client=_build_httpx_client(30.0),
            postgrest_client_timeout=30,
            storage_client_timeout=20,
            function_client_timeout=10,
        ),
    )


def reset_supabase_clients() -> None:
    global _auth_client, _admin_client
    _auth_client = None
    _admin_client = None


def _is_transient_transport_error(exc: Exception) -> bool:
    if isinstance(exc, (httpx.HTTPError, httpx.TransportError, OSError)):
        return True
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "server disconnected",
            "connection reset",
            "connection refused",
            "eof occurred",
            "ssl",
            "readerror",
            "timeout",
            "winerror 10035",
        )
    )


def get_user_table_client(*, use_admin: bool, allow_fallback: bool = True) -> Client:
    if use_admin:
        client = get_supabase_admin_client()
        if client is not None:
            return client
        if not allow_fallback:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY es requerida para esta operación")
    return get_supabase_auth_client()


def get_supabase_auth_client() -> Client:
    global _auth_client
    if _auth_client is None:
        if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
            raise RuntimeError("Configura SUPABASE_URL y SUPABASE_KEY en backend/.env")
        _auth_client = _create_supabase_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    return _auth_client


def get_supabase_admin_client() -> Client | None:
    global _admin_client
    if _admin_client is None:
        if not Config.SUPABASE_URL or not Config.SUPABASE_SERVICE_ROLE_KEY:
            return None
        _admin_client = _create_supabase_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)
    return _admin_client


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat()


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _error_text(exc: Exception) -> str:
    parts = [str(exc or ""), getattr(exc, "message", None), getattr(exc, "details", None), getattr(exc, "hint", None)]
    return " ".join(str(part) for part in parts if part)


def _extract_missing_column(exc: Exception, table_name: str) -> str | None:
    message = _error_text(exc)
    patterns = [
        rf"could not find the '([^']+)' column of '{re.escape(table_name)}' in the schema cache",
        rf"column\s+(?:public\.)?{re.escape(table_name)}\.\"?([^\s\"']+)\"?\s+does not exist",
        rf"column\s+\"?([^\s\"']+)\"?\s+of relation\s+\"?{re.escape(table_name)}\"?\s+does not exist",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1).strip('"')
    return None


def _extract_missing_table(exc: Exception) -> str | None:
    message = _error_text(exc).lower()
    match = re.search(r"could not find the table 'public\.([^']+)'", message)
    if match:
        return match.group(1)
    match = re.search(r'relation\s+"?public\.([^"\s]+)"?\s+does not exist', message)
    if match:
        return match.group(1)
    return None


def _clone_filters(filters: list[dict] | None) -> list[dict]:
    return [dict(item) for item in (filters or [])]


def _first_present(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return default


def select_rows(
    table_name: str,
    *,
    filters: list[dict] | None = None,
    order_candidates: list[str] | None = None,
    desc: bool = False,
    limit: int | None = None,
) -> list[dict]:
    query_filters = _clone_filters(filters)
    ordering = list(order_candidates or [])
    if not ordering:
        ordering = [None]
    attempts_remaining = 2

    while True:
        order_column = ordering[0] if ordering else None
        try:
            query = get_user_table_client(use_admin=True).table(table_name).select("*")
            for item in query_filters:
                value = item.get("value")
                if value is None:
                    continue
                query = query.eq(item["column"], value)
            if order_column:
                query = query.order(order_column, desc=desc)
            if limit:
                query = query.limit(limit)
            response = query.execute()
            return response.data or []
        except APIError as exc:
            missing_table = _extract_missing_table(exc)
            if missing_table == table_name:
                return []
            missing_column = _extract_missing_column(exc, table_name)
            if order_column and missing_column == order_column:
                ordering.pop(0)
                if not ordering:
                    ordering = [None]
                continue
            optional_filter = next(
                (
                    item
                    for item in query_filters
                    if item.get("optional") and item.get("column") == missing_column
                ),
                None,
            )
            if optional_filter:
                query_filters.remove(optional_filter)
                continue
            raise
        except Exception as exc:
            if attempts_remaining > 0 and _is_transient_transport_error(exc):
                attempts_remaining -= 1
                reset_supabase_clients()
                continue
            return []


def insert_row(table_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    current_payload = {key: value for key, value in payload.items() if value is not None}
    while True:
        try:
            response = get_user_table_client(use_admin=True).table(table_name).insert(current_payload).execute()
            data = response.data or []
            return data[0] if data else current_payload
        except APIError as exc:
            missing_table = _extract_missing_table(exc)
            if missing_table == table_name:
                return current_payload
            missing_column = _extract_missing_column(exc, table_name)
            if missing_column and missing_column in current_payload:
                current_payload.pop(missing_column, None)
                continue
            raise


def update_rows(table_name: str, *, payload: dict[str, Any], filters: list[dict]) -> list[dict]:
    current_payload = dict(payload)
    query_filters = _clone_filters(filters)
    while True:
        try:
            query = get_user_table_client(use_admin=True).table(table_name).update(current_payload)
            for item in query_filters:
                value = item.get("value")
                if value is None:
                    continue
                query = query.eq(item["column"], value)
            response = query.execute()
            return response.data or []
        except APIError as exc:
            missing_table = _extract_missing_table(exc)
            if missing_table == table_name:
                return []
            missing_column = _extract_missing_column(exc, table_name)
            if missing_column and missing_column in current_payload:
                current_payload.pop(missing_column, None)
                continue
            optional_filter = next(
                (
                    item
                    for item in query_filters
                    if item.get("optional") and item.get("column") == missing_column
                ),
                None,
            )
            if optional_filter:
                query_filters.remove(optional_filter)
                continue
            raise


def get_user_email(user: Any) -> str | None:
    email = getattr(user, "email", None)
    return str(email).strip().lower() if email else None


def get_user_metadata(user: Any) -> dict[str, Any]:
    metadata = getattr(user, "user_metadata", None) or {}
    return metadata if isinstance(metadata, dict) else {}


def get_user_display_name(user: Any) -> str:
    metadata = get_user_metadata(user)
    for key in ("full_name", "name", "nombre"):
        value = metadata.get(key)
        if value:
            return str(value).strip()
    return get_user_email(user) or "Usuario"


def get_user_role(user: Any) -> str:
    metadata = get_user_metadata(user)
    for key in ("role", "rol"):
        value = metadata.get(key)
        if value:
            return str(value).strip().lower()
    role = getattr(user, "role", None)
    if role and str(role).strip().lower() not in {"authenticated", "anon"}:
        return str(role).strip().lower()
    return "usuario"


def _find_user_profile(auth_user_id: str | None, email: str | None) -> dict[str, Any] | None:
    return None  # TEMPORAL: deshabilitado por loop infinito


def get_user_garage_id(user: Any, fallback: str | None = None) -> str:
    metadata = get_user_metadata(user)
    for key in ("garage_id", "garaje_id"):
        value = metadata.get(key)
        if value:
            return str(value)

    profile = _find_user_profile(
        str(getattr(user, "id", "") or "") or None,
        get_user_email(user),
    )
    if profile:
        for key in ("garage_id", "garaje_id"):
            value = profile.get(key)
            if value:
                return str(value)

    if fallback:
        return str(fallback)
    return Config.DEFAULT_GARAGE_ID


def ensure_auth_user_metadata(
    *,
    user_id: str,
    email: str | None,
    name: str | None,
    garage_id: str | None,
    role: str | None,
) -> None:
    if not user_id:
        return
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return
    try:
        response = admin_client.auth.admin.get_user_by_id(user_id)
        user = getattr(response, "user", None)
        metadata = get_user_metadata(user)
    except Exception:
        metadata = {}

    next_metadata = {
        **metadata,
        "name": name or metadata.get("name") or email or "Usuario",
        "full_name": name or metadata.get("full_name") or email or "Usuario",
        "garage_id": garage_id or metadata.get("garage_id") or Config.DEFAULT_GARAGE_ID,
        "role": role or metadata.get("role") or "usuario",
    }
    try:
        admin_client.auth.admin.update_user_by_id(user_id, {"user_metadata": next_metadata})
    except Exception:
        return


def ensure_user_profile(user: Any, *, garage_id: str | None = None, name: str | None = None, role: str | None = None) -> dict[str, Any] | None:
    user_id = str(getattr(user, "id", "") or "")
    email = get_user_email(user)
    if not user_id and not email:
        return None

    resolved_garage_id = garage_id or get_user_garage_id(user)
    resolved_name = name or get_user_display_name(user)
    resolved_role = role or get_user_role(user)
    existing = _find_user_profile(user_id or None, email)
    payload = {
        "id": user_id or None,
        "auth_user_id": user_id or None,
        "user_id": user_id or None,
        "email": email,
        "nombre": resolved_name,
        "name": resolved_name,
        "full_name": resolved_name,
        "garage_id": resolved_garage_id,
        "rol": resolved_role,
        "role": resolved_role,
        "updated_at": utcnow_iso(),
        "created_at": utcnow_iso(),
    }

    update_payload = dict(payload)
    update_payload.pop("id", None)
    update_payload.pop("created_at", None)

    fallback_payload = dict(payload)
    fallback_payload.pop("garage_id", None)
    fallback_update_payload = dict(update_payload)
    fallback_update_payload.pop("garage_id", None)

    try:
        if existing and existing.get("id"):
            rows = update_rows(
                "users",
                payload=update_payload,
                filters=[{"column": "id", "value": existing.get("id"), "optional": False}],
            )
            return rows[0] if rows else existing

        return insert_row("users", payload)
    except Exception as exc:
        message = str(exc).lower()
        if "invalid input syntax for type integer" not in message:
            return existing
        try:
            if existing and existing.get("id"):
                rows = update_rows(
                    "users",
                    payload=fallback_update_payload,
                    filters=[{"column": "id", "value": existing.get("id"), "optional": False}],
                )
                return rows[0] if rows else existing
            return insert_row("users", fallback_payload)
        except Exception:
            return existing


def log_auth_event(
    *,
    event: str,
    success: bool,
    user_id: str | None = None,
    email: str | None = None,
    garage_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    try:
        insert_row(
            "auth_logs",
            {
                "user_id": user_id,
                "auth_user_id": user_id,
                "email": email,
                "garage_id": garage_id,
                "event": event,
                "action": event,
                "status": "success" if success else "failed",
                "success": success,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "details": details or {},
                "metadata": details or {},
                "created_at": utcnow_iso(),
            },
        )
    except Exception:
        return


def create_access_alert(
    *,
    user_id: str | None = None,
    email: str | None = None,
    garage_id: str | None = None,
    role: str | None = None,
    route: str | None = None,
    reason: str | None = None,
    alert_type: str = "acceso_denegado",
) -> None:
    try:
        insert_row(
            "alertas_acceso",
            {
                "garage_id": garage_id,
                "descripcion": reason or "Acceso no autorizado detectado",
                "tipo_alerta": alert_type,
                "fecha": utcnow_iso(),
                "estado": "pendiente",
                "user_id": user_id,
                "auth_user_id": user_id,
                "email": email,
                "role": role,
                "rol": role,
                "ruta_denegada": route,
                "route": route,
                "reason": reason,
                "tipo": alert_type,
                "created_at": utcnow_iso(),
            },
        )
    except Exception:
        return


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr


def normalize_vehicle(row: dict[str, Any]) -> dict[str, Any]:
    owner_id = _first_present(row, "propietario_id", "user_id", "auth_user_id", "owner_id")
    owner_name = _first_present(
        row,
        "propietario_nombre",
        "owner_name",
        "propietario",
        "owner",
        "nombre",
        "name",
        default="",
    )
    plate = str(_first_present(row, "placa", "plate", "license_plate", default="")).strip().upper()
    status = normalize_text(_first_present(row, "status", "estado", default=""))
    exit_time = _first_present(row, "salida", "exit_time", "hora_salida", "hora_fin")

    is_active = row.get("is_active")
    if is_active is None:
        is_active = status in {"dentro", "activo", "active", "inside"}
        if exit_time or status in {"completed", "finalizado", "fuera", "salio", "salido"}:
            is_active = False

    return {
        **row,
        "id": row.get("id"),
        "garage_id": row.get("garage_id"),
        "propietario_id": owner_id,
        "user_id": owner_id,
        "placa": plate,
        "plate": plate,
        "brand": _first_present(row, "marca", "brand", default=""),
        "marca": _first_present(row, "marca", "brand", default=""),
        "model": _first_present(row, "modelo", "model", default=""),
        "modelo": _first_present(row, "modelo", "model", default=""),
        "type": _first_present(row, "tipo", "type", "vehicle_type", default=""),
        "tipo": _first_present(row, "tipo", "type", "vehicle_type", default=""),
        "color": row.get("color") or "",
        "propietario": owner_name,
        "owner_name": owner_name,
        "owner_email": _first_present(row, "owner_email", "email", default=""),
        "status": status or ("dentro" if is_active else row.get("status") or ""),
        "estado": row.get("estado") or ("dentro" if is_active else status),
        "is_active": bool(is_active),
    }


def normalize_parking_space(row: dict[str, Any]) -> dict[str, Any]:
    code = _first_present(row, "numero", "codigo", "code", "space_number", "nombre", default="")
    floor = _first_present(row, "piso", "floor", "nivel", default="")
    if not floor and code:
        match = re.match(r"([A-Za-z])", str(code).strip())
        if match:
            floor = match.group(1).upper()
    occupied_flag = row.get("ocupado")
    raw_status = _first_present(row, "status", "estado", default="available")
    status = normalize_text(raw_status)
    if occupied_flag is True:
        status = "occupied"
    elif occupied_flag is False:
        status = "available"
    elif status in {"ocupado", "busy"}:
        status = "occupied"
    elif status in {"disponible", "free", ""}:
        status = "available"
    occupied = status == "occupied"
    estado = "ocupado" if occupied else "disponible"

    return {
        **row,
        "id": row.get("id"),
        "garage_id": row.get("garage_id"),
        "numero": code,
        "codigo": code,
        "nombre": code,
        "numero_mostrar": code,
        "piso": str(floor or "").strip().upper(),
        "nivel": str(floor or "").strip().upper(),
        "nivel_mostrar": str(floor or "").strip().upper(),
        "code": code,
        "floor": str(floor or "").strip().upper(),
        "vehiculo_id": _first_present(row, "vehiculo_id", "vehicle_id"),
        "vehicle_id": _first_present(row, "vehiculo_id", "vehicle_id"),
        "tipo_espacio": _first_present(row, "tipo_espacio", "space_type", "tipo", "type", default=""),
        "tipo": _first_present(row, "tipo_espacio", "space_type", "tipo", "type", default=""),
        "space_type": _first_present(row, "tipo_espacio", "space_type", "tipo", "type", default=""),
        "status": status,
        "estado": estado,
        "ocupado": occupied,
        "occupied": occupied,
    }


def normalize_session(row: dict[str, Any]) -> dict[str, Any]:
    amount_value = _first_present(row, "amount", "total_amount", "monto_total", "costo", default=0)
    try:
        amount = round(float(amount_value or 0), 2)
    except (TypeError, ValueError):
        amount = 0.0

    duration_value = _first_present(row, "duracion", "duration_minutes", "duracion_minutos", default=0)
    try:
        duration_minutes = int(duration_value or 0)
    except (TypeError, ValueError):
        duration_minutes = 0

    status = normalize_text(_first_present(row, "status", "estado", default="active"))
    if status in {"activo"}:
        status = "active"
    elif status in {"finalizado", "cerrado", "completado", "fuera"}:
        status = "completed"

    entry_time = _first_present(row, "entrada", "entry_time", "hora_entrada", "hora_inicio")
    exit_time = _first_present(row, "salida", "exit_time", "hora_salida", "hora_fin")
    space_code = _first_present(row, "espacio", "space_code", "codigo_espacio", default="")
    is_active = row.get("is_active")
    if is_active is None:
        is_active = not bool(exit_time) and status != "completed"

    return {
        **row,
        "id": row.get("id"),
        "garage_id": row.get("garage_id"),
        "usuario_id": _first_present(row, "usuario_id", "user_id"),
        "user_id": _first_present(row, "usuario_id", "user_id"),
        "vehiculo_id": _first_present(row, "vehiculo_id", "vehicle_id"),
        "vehicle_id": _first_present(row, "vehiculo_id", "vehicle_id"),
        "espacio_id": _first_present(row, "espacio_id", "space_id", "parking_space_id"),
        "space_id": _first_present(row, "espacio_id", "space_id", "parking_space_id"),
        "espacio": space_code,
        "space_code": space_code,
        "entrada": entry_time,
        "entry_time": entry_time,
        "salida": exit_time,
        "exit_time": exit_time,
        "duracion": duration_minutes,
        "plate": str(_first_present(row, "placa", "plate", default="")).strip().upper(),
        "owner_name": _first_present(row, "owner_name", "propietario", "owner", default=""),
        "status": status or "active",
        "is_active": bool(is_active),
        "duration_minutes": duration_minutes,
        "amount": amount,
        "monto_total": amount,
        "total_amount": amount,
        "payment_status": _first_present(row, "payment_status", "estado_pago"),
        "paid": row.get("paid"),
        "paid_at": _first_present(row, "paid_at", "fecha_pago"),
    }


def filter_rows_by_garage(rows: list[dict[str, Any]], garage_id: str, *, normalizer: Callable[[dict[str, Any]], dict[str, Any]]) -> list[dict]:
    normalized = [normalizer(row) for row in rows]
    wanted = normalize_text(garage_id)
    return [row for row in normalized if not row.get("garage_id") or normalize_text(row.get("garage_id")) == wanted]


def row_belongs_to_user(row: dict[str, Any], user_id: str | None, email: str | None) -> bool:
    candidates = [
        normalize_text(row.get("user_id")),
        normalize_text(row.get("auth_user_id")),
        normalize_text(row.get("owner_id")),
        normalize_text(row.get("owner_email")),
        normalize_text(row.get("email")),
    ]
    expected = {normalize_text(user_id), normalize_text(email)}
    expected.discard("")
    if not expected:
        return True
    return any(candidate in expected for candidate in candidates if candidate)


def get_hourly_rate(garage_id: str, *, fallback: float) -> float:
    settings = select_rows(
        "settings",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["created_at", "updated_at"],
        desc=True,
        limit=5,
    )
    for row in settings:
        value = _first_present(
            row,
            "hourly_rate",
            "tarifa_hora",
            "tarifa_minima",
            "rate_per_hour",
            "amount",
            "rate",
            "precio_por_hora",
            "precio_hora",
            "monto",
        )
        if value in (None, ""):
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return float(fallback)
