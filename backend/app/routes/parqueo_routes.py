"""
backend/routes/parqueos.py
Rutas para: Dashboard, Portería, Espacios, Sesiones, Vehículos, Cobros, Reportes
"""
from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from utils.decorators import auth_required
from utils.supabase_client import (
    filter_rows_by_garage,
    insert_row,
    normalize_parking_space,
    normalize_session,
    normalize_vehicle,
    select_rows,
    update_rows,
    utcnow_iso,
)

parqueos_bp = Blueprint("parqueos", __name__, url_prefix="/api")


# ══════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════

def _garage() -> str:
    return g.current_user_garage_id


def _ok(data, **kwargs):
    return jsonify({"success": True, "data": data, **kwargs})


def _err(msg: str, code: int = 400):
    return jsonify({"success": False, "error": msg}), code


# ══════════════════════════════════════════════════════════════
#  PARKING SPACES  — /api/parqueos
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/parqueos")
@auth_required
def get_parqueos():
    """Devuelve todos los espacios del garaje."""
    garage_id = _garage()
    rows = select_rows(
        "parking_spaces",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["numero", "codigo", "nombre", "created_at"],
    )
    spaces = filter_rows_by_garage(rows, garage_id, normalizer=normalize_parking_space)
    return _ok(spaces, total=len(spaces))


@parqueos_bp.post("/parqueos")
@auth_required
def create_parqueo():
    """Crea un nuevo espacio de parqueo."""
    body = request.get_json(silent=True) or {}
    garage_id = _garage()

    numero = str(body.get("numero") or body.get("codigo") or "").strip().upper()
    if not numero:
        return _err("El campo 'numero' es requerido")

    piso = str(body.get("piso") or body.get("nivel") or "").strip().upper()
    if not piso and numero:
        import re
        match = re.match(r"([A-Za-z])", numero)
        piso = match.group(1).upper() if match else "A"

    payload = {
        "garage_id": garage_id,
        "numero": numero,
        "codigo": numero,
        "nombre": numero,
        "piso": piso,
        "nivel": piso,
        "nivel_mostrar": f"Piso {piso}",
        "tipo": body.get("tipo") or "estandar",
        "tipo_espacio": body.get("tipo") or "estandar",
        "estado": "disponible",
        "status": "available",
        "ocupado": False,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    row = insert_row("parking_spaces", payload)
    return _ok(normalize_parking_space(row)), 201


@parqueos_bp.put("/parqueos/<space_id>")
@auth_required
def update_parqueo(space_id: str):
    """Actualiza un espacio (estado, vehiculo_id, etc.)."""
    body = request.get_json(silent=True) or {}
    payload = {k: v for k, v in body.items() if k not in ("id", "garage_id")}
    payload["updated_at"] = utcnow_iso()

    rows = update_rows(
        "parking_spaces",
        payload=payload,
        filters=[
            {"column": "id", "value": space_id, "optional": False},
            {"column": "garage_id", "value": _garage(), "optional": False},
        ],
    )
    if not rows:
        return _err("Espacio no encontrado", 404)
    return _ok(normalize_parking_space(rows[0]))


@parqueos_bp.delete("/parqueos/<space_id>")
@auth_required
def delete_parqueo(space_id: str):
    """Elimina un espacio."""
    from utils.supabase_client import get_user_table_client
    get_user_table_client(use_admin=True).table("parking_spaces").delete().eq("id", space_id).eq("garage_id", _garage()).execute()
    return _ok({"id": space_id})


# ══════════════════════════════════════════════════════════════
#  VEHICLES  — /api/vehiculos
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/vehiculos")
@auth_required
def get_vehiculos():
    """Lista vehículos. Admins ven todos, usuarios solo los suyos."""
    garage_id = _garage()
    role = g.current_user_role
    user_id = g.current_user_id

    base_filters = [{"column": "garage_id", "value": garage_id, "optional": True}]
    if role not in ("admin", "portero"):
        base_filters.append({"column": "user_id", "value": user_id, "optional": True})

    rows = select_rows(
        "vehicles",
        filters=base_filters,
        order_candidates=["created_at", "updated_at"],
        desc=True,
    )
    vehicles = filter_rows_by_garage(rows, garage_id, normalizer=normalize_vehicle)
    return _ok(vehicles, total=len(vehicles))


@parqueos_bp.post("/vehiculos")
@auth_required
def create_vehiculo():
    """Registra un vehículo."""
    body = request.get_json(silent=True) or {}
    garage_id = _garage()

    placa = str(body.get("placa") or body.get("plate") or "").strip().upper()
    if not placa:
        return _err("El campo 'placa' es requerido")

    payload = {
        "garage_id": garage_id,
        "user_id": g.current_user_id,
        "auth_user_id": g.current_user_id,
        "placa": placa,
        "marca": body.get("marca") or body.get("brand") or "",
        "modelo": body.get("modelo") or body.get("model") or "",
        "tipo": body.get("tipo") or "sedan",
        "color": body.get("color") or "",
        "propietario": body.get("propietario") or body.get("owner_name") or g.current_user_name,
        "email": body.get("email") or g.current_user_email,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    row = insert_row("vehicles", payload)
    return _ok(normalize_vehicle(row)), 201


@parqueos_bp.put("/vehiculos/<vehicle_id>")
@auth_required
def update_vehiculo(vehicle_id: str):
    body = request.get_json(silent=True) or {}
    payload = {k: v for k, v in body.items() if k not in ("id", "garage_id")}
    payload["updated_at"] = utcnow_iso()
    rows = update_rows("vehicles", payload=payload, filters=[{"column": "id", "value": vehicle_id}])
    if not rows:
        return _err("Vehículo no encontrado", 404)
    return _ok(normalize_vehicle(rows[0]))


@parqueos_bp.delete("/vehiculos/<vehicle_id>")
@auth_required
def delete_vehiculo(vehicle_id: str):
    from utils.supabase_client import get_user_table_client
    get_user_table_client(use_admin=True).table("vehicles").delete().eq("id", vehicle_id).execute()
    return _ok({"id": vehicle_id})


# ══════════════════════════════════════════════════════════════
#  PARKING SESSIONS  — /api/sesiones
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/sesiones")
@auth_required
def get_sesiones():
    """Historial de sesiones del garaje."""
    garage_id = _garage()
    rows = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["hora_entrada", "entrada", "created_at"],
        desc=True,
    )
    sessions = filter_rows_by_garage(rows, garage_id, normalizer=normalize_session)
    return _ok(sessions, total=len(sessions))


@parqueos_bp.get("/sesiones/activas")
@auth_required
def get_sesiones_activas():
    """Sesiones actualmente activas (vehículos dentro)."""
    garage_id = _garage()
    rows = select_rows(
        "parking_sessions",
        filters=[
            {"column": "garage_id", "value": garage_id, "optional": True},
            {"column": "estado", "value": "activo", "optional": True},
        ],
        order_candidates=["hora_entrada", "entrada", "created_at"],
        desc=True,
    )
    # Fallback: filtrar por is_active si estado no funciona
    all_rows = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["hora_entrada", "entrada", "created_at"],
        desc=True,
    )
    normalized = [normalize_session(r) for r in all_rows]
    garage_normalized = [r for r in normalized if not r.get("garage_id") or r.get("garage_id") == garage_id]
    active = [r for r in garage_normalized if r.get("status") == "active" or r.get("is_active")]
    return _ok(active, total=len(active))


@parqueos_bp.post("/sesiones/entrada")
@auth_required
def registrar_entrada():
    """Registra la entrada de un vehículo."""
    body = request.get_json(silent=True) or {}
    garage_id = _garage()

    placa = str(body.get("placa") or body.get("plate") or "").strip().upper()
    espacio_id = body.get("espacio_id") or body.get("space_id")
    if not placa:
        return _err("La placa es requerida")
    if not espacio_id:
        return _err("El espacio es requerido")

    now = utcnow_iso()

    # Marcar espacio como ocupado
    update_rows(
        "parking_spaces",
        payload={"ocupado": True, "estado": "ocupado", "status": "occupied", "updated_at": now},
        filters=[
            {"column": "id", "value": espacio_id, "optional": False},
            {"column": "garage_id", "value": garage_id, "optional": False},
        ],
    )

    # Buscar vehículo por placa
    vehicle_rows = select_rows("vehicles", filters=[
        {"column": "placa", "value": placa, "optional": True},
        {"column": "garage_id", "value": garage_id, "optional": True},
    ], limit=1)
    vehicle = vehicle_rows[0] if vehicle_rows else {}

    payload = {
        "garage_id": garage_id,
        "usuario_id": g.current_user_id,
        "user_id": g.current_user_id,
        "vehiculo_id": vehicle.get("id"),
        "espacio_id": espacio_id,
        "placa": placa,
        "propietario": body.get("propietario") or vehicle.get("propietario") or "",
        "espacio": body.get("espacio") or body.get("space_code") or "",
        "hora_entrada": now,
        "entrada": now,
        "estado": "activo",
        "status": "active",
        "is_active": True,
        "monto_total": 0,
        "total_amount": 0,
        "amount": 0,
        "duracion": 0,
        "created_at": now,
        "updated_at": now,
    }
    row = insert_row("parking_sessions", payload)
    return _ok(normalize_session(row)), 201


@parqueos_bp.post("/sesiones/salida/<session_id>")
@auth_required
def registrar_salida(session_id: str):
    """Registra la salida y calcula el cobro."""
    body = request.get_json(silent=True) or {}
    garage_id = _garage()

    # Obtener sesión
    sessions = select_rows("parking_sessions", filters=[{"column": "id", "value": session_id}], limit=1)
    if not sessions:
        return _err("Sesión no encontrada", 404)
    session = normalize_session(sessions[0])

    from utils.supabase_client import get_hourly_rate, parse_datetime
    from datetime import datetime, timezone

    entry_raw = session.get("entrada") or session.get("entry_time")
    entry_dt = parse_datetime(entry_raw)
    exit_dt = datetime.now(timezone.utc)
    now_iso = exit_dt.isoformat()

    duration_minutes = 0
    amount = 0.0
    if entry_dt:
        diff = exit_dt - entry_dt
        duration_minutes = max(1, int(diff.total_seconds() / 60))
        hourly_rate = get_hourly_rate(garage_id, fallback=float(body.get("tarifa", 50)))
        amount = round((duration_minutes / 60) * hourly_rate, 2)

    # Actualizar sesión
    update_rows(
        "parking_sessions",
        payload={
            "hora_salida": now_iso,
            "salida": now_iso,
            "exit_time": now_iso,
            "hora_fin": now_iso,
            "estado": "finalizado",
            "status": "completed",
            "is_active": False,
            "duracion": duration_minutes,
            "duration_minutes": duration_minutes,
            "duracion_minutos": duration_minutes,
            "monto_total": amount,
            "total_amount": amount,
            "amount": amount,
            "updated_at": now_iso,
        },
        filters=[{"column": "id", "value": session_id}],
    )

    # Liberar espacio
    espacio_id = session.get("espacio_id") or session.get("space_id")
    if espacio_id:
        update_rows(
            "parking_spaces",
            payload={
                "ocupado": False,
                "estado": "disponible",
                "status": "available",
                "vehiculo_id": None,
                "updated_at": now_iso,
            },
            filters=[
                {"column": "id", "value": espacio_id, "optional": False},
                {"column": "garage_id", "value": garage_id, "optional": False},
            ],
        )

    # Registrar pago
    insert_row("payments", {
        "session_id": session_id,
        "garage_id": garage_id,
        "user_id": g.current_user_id,
        "monto": amount,
        "amount": amount,
        "metodo": body.get("metodo") or "efectivo",
        "payment_method": body.get("metodo") or "efectivo",
        "method": body.get("metodo") or "efectivo",
        "estado": "completado",
        "status": "completed",
        "fecha": now_iso,
        "created_at": now_iso,
    })

    return _ok({
        "session_id": session_id,
        "duration_minutes": duration_minutes,
        "amount": amount,
        "exit_time": now_iso,
    })


@parqueos_bp.post("/sesiones/liberar/<space_id>")
@auth_required
def liberar_espacio(space_id: str):
    """Libera un espacio directamente."""
    now = utcnow_iso()
    update_rows(
        "parking_spaces",
        payload={
            "ocupado": False,
            "estado": "disponible",
            "status": "available",
            "vehiculo_id": None,
            "updated_at": now,
        },
        filters=[
            {"column": "id", "value": space_id, "optional": False},
            {"column": "garage_id", "value": _garage(), "optional": False},
        ],
    )
    return _ok({"space_id": space_id, "status": "disponible"})


# ══════════════════════════════════════════════════════════════
#  PAYMENTS / COBROS  — /api/cobros
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/cobros")
@auth_required
def get_cobros():
    garage_id = _garage()
    rows = select_rows(
        "payments",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["fecha", "created_at"],
        desc=True,
    )
    return _ok(rows, total=len(rows))


# ══════════════════════════════════════════════════════════════
#  USUARIOS  — /api/usuarios
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/usuarios")
@auth_required
def get_usuarios():
    """Solo admins pueden ver usuarios."""
    if g.current_user_role not in ("admin",):
        return _err("Sin permisos", 403)
    garage_id = _garage()
    rows = select_rows(
        "users",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["created_at"],
        desc=True,
    )
    return _ok(rows, total=len(rows))


@parqueos_bp.put("/usuarios/<user_id>")
@auth_required
def update_usuario(user_id: str):
    if g.current_user_role not in ("admin",):
        return _err("Sin permisos", 403)
    body = request.get_json(silent=True) or {}
    payload = {k: v for k, v in body.items() if k not in ("id", "auth_user_id")}
    payload["updated_at"] = utcnow_iso()
    rows = update_rows("users", payload=payload, filters=[{"column": "id", "value": user_id}])
    if not rows:
        return _err("Usuario no encontrado", 404)
    return _ok(rows[0])


@parqueos_bp.delete("/usuarios/<user_id>")
@auth_required
def delete_usuario(user_id: str):
    if g.current_user_role not in ("admin",):
        return _err("Sin permisos", 403)
    from utils.supabase_client import get_user_table_client
    get_user_table_client(use_admin=True).table("users").delete().eq("id", user_id).execute()
    return _ok({"id": user_id})


# ══════════════════════════════════════════════════════════════
#  REPORTES  — /api/reportes
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/reportes")
@auth_required
def get_reportes():
    """Datos agregados para la página de reportes."""
    garage_id = _garage()

    sessions = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["hora_entrada", "created_at"],
        desc=True,
    )
    spaces = select_rows(
        "parking_spaces",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
    )
    payments = select_rows(
        "payments",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["fecha", "created_at"],
        desc=True,
    )

    normalized_sessions = [normalize_session(r) for r in sessions]
    normalized_spaces = [normalize_parking_space(r) for r in spaces]

    total_ingresos = sum(float(p.get("monto") or p.get("amount") or 0) for p in payments)
    ocupados = sum(1 for s in normalized_spaces if s.get("occupied"))
    total_spaces = len(normalized_spaces)

    return _ok({
        "sesiones": normalized_sessions,
        "espacios": normalized_spaces,
        "pagos": payments,
        "resumen": {
            "total_sesiones": len(normalized_sessions),
            "total_ingresos": round(total_ingresos, 2),
            "espacios_ocupados": ocupados,
            "espacios_total": total_spaces,
            "ocupacion_pct": round((ocupados / total_spaces * 100) if total_spaces else 0, 1),
        },
    })


# ══════════════════════════════════════════════════════════════
#  DASHBOARD  — /api/dashboard
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/dashboard")
@auth_required
def get_dashboard():
    """Resumen ejecutivo para el dashboard principal."""
    garage_id = _garage()

    spaces = select_rows(
        "parking_spaces",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
    )
    normalized_spaces = [normalize_parking_space(r) for r in spaces]
    ocupados = sum(1 for s in normalized_spaces if s.get("occupied"))
    total = len(normalized_spaces)

    # Sesiones activas
    all_sessions = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["hora_entrada", "created_at"],
        desc=True,
        limit=50,
    )
    normalized = [normalize_session(r) for r in all_sessions]
    activas = [r for r in normalized if r.get("status") == "active" or r.get("is_active")]
    recientes = normalized[:10]

    # Ingresos de hoy
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    payments_today = select_rows(
        "payments",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["fecha", "created_at"],
        desc=True,
    )
    ingresos_hoy = sum(
        float(p.get("monto") or p.get("amount") or 0)
        for p in payments_today
        if str(p.get("fecha") or p.get("created_at") or "").startswith(today)
    )

    return _ok({
        "espacios_ocupados": ocupados,
        "espacios_disponibles": total - ocupados,
        "total_espacios": total,
        "ocupacion_pct": round((ocupados / total * 100) if total else 0, 1),
        "vehiculos_dentro": len(activas),
        "ingresos_hoy": round(ingresos_hoy, 2),
        "sesiones_recientes": recientes,
        "espacios": normalized_spaces,
    })


# ══════════════════════════════════════════════════════════════
#  NOTIFICACIONES  — /api/notificaciones
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/notificaciones")
@auth_required
def get_notificaciones():
    garage_id = _garage()
    rows = select_rows(
        "notifications",
        filters=[
            {"column": "garage_id", "value": garage_id, "optional": True},
            {"column": "user_id", "value": g.current_user_id, "optional": True},
        ],
        order_candidates=["created_at"],
        desc=True,
        limit=20,
    )
    return _ok(rows, total=len(rows))


@parqueos_bp.put("/notificaciones/<notif_id>/leida")
@auth_required
def marcar_leida(notif_id: str):
    rows = update_rows(
        "notifications",
        payload={"leida": True},
        filters=[{"column": "id", "value": notif_id}],
    )
    return _ok(rows[0] if rows else {"id": notif_id})


# ══════════════════════════════════════════════════════════════
#  ALERTAS ACCESO  — /api/alertas
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/alertas")
@auth_required
def get_alertas():
    if g.current_user_role not in ("admin",):
        return _err("Sin permisos", 403)
    garage_id = _garage()
    rows = select_rows(
        "access_alerts",
        filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
        order_candidates=["fecha", "created_at"],
        desc=True,
    )
    return _ok(rows, total=len(rows))


# ══════════════════════════════════════════════════════════════
#  CONFIGURACIÓN / SETTINGS  — /api/configuracion
# ══════════════════════════════════════════════════════════════

@parqueos_bp.get("/configuracion")
@auth_required
def get_configuracion():
    rows = select_rows(
        "settings",
        filters=[
            {"column": "user_id", "value": g.current_user_id, "optional": True},
        ],
        limit=1,
    )
    config = rows[0] if rows else {}
    return _ok(config)


@parqueos_bp.put("/configuracion")
@auth_required
def update_configuracion():
    body = request.get_json(silent=True) or {}
    payload = {k: v for k, v in body.items() if k not in ("id",)}
    payload["user_id"] = g.current_user_id
    payload["garage_id"] = _garage()
    payload["updated_at"] = utcnow_iso()

    existing = select_rows("settings", filters=[{"column": "user_id", "value": g.current_user_id, "optional": True}], limit=1)
    if existing:
        rows = update_rows("settings", payload=payload, filters=[{"column": "id", "value": existing[0]["id"]}])
        return _ok(rows[0] if rows else existing[0])
    payload["created_at"] = utcnow_iso()
    row = insert_row("settings", payload)
    return _ok(row), 201
