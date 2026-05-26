from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from utils.decorators import auth_required
from utils.pagination import get_pagination_params, paginate_items
from utils.supabase_client import insert_row, normalize_parking_space, normalize_text, select_rows, update_rows, utcnow_iso
from utils.validators import normalize_plate, validate_plate


visitantes_bp = Blueprint("visitantes", __name__, url_prefix="/api/visitantes")


def _normalize_visitor(row: dict, spaces_by_id: dict[str, dict] | None = None) -> dict:
    spaces_by_id = spaces_by_id or {}
    space_id = str(row.get("espacio_id") or "")
    space = spaces_by_id.get(space_id, {})
    plate = str(row.get("placa") or "").strip().upper()
    status = normalize_text(row.get("estado")) or "dentro"

    return {
        **row,
        "id": row.get("id"),
        "garage_id": row.get("garage_id"),
        "nombre": row.get("nombre") or "",
        "cedula": row.get("cedula") or "",
        "telefono": row.get("telefono") or "",
        "placa": plate,
        "plate": plate,
        "modelo": row.get("modelo") or "",
        "model": row.get("modelo") or "",
        "espacio_id": row.get("espacio_id"),
        "space_id": row.get("espacio_id"),
        "espacio": space.get("codigo") or space.get("numero") or row.get("espacio") or "Sin espacio",
        "space_label": space.get("codigo") or space.get("numero") or row.get("espacio") or "Sin espacio",
        "entrada": row.get("entrada"),
        "entry_time": row.get("entrada"),
        "salida": row.get("salida"),
        "exit_time": row.get("salida"),
        "duracion_estimada": row.get("duracion_estimada"),
        "notas": row.get("notas") or "",
        "estado": "dentro" if status not in {"fuera"} else "fuera",
        "status": "dentro" if status not in {"fuera"} else "fuera",
    }


def _garage_spaces_index() -> dict[str, dict]:
    rows = select_rows(
        "parking_spaces",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
        order_candidates=["numero", "piso", "created_at"],
    )
    spaces = [normalize_parking_space(row) for row in rows]
    return {str(space.get("id") or ""): space for space in spaces}


def _set_space_status(space_id: str | None, status: str) -> None:
    if not space_id:
        return
    occupied = normalize_text(status) in {"ocupado", "occupied", "busy"}
    update_rows(
        "parking_spaces",
        payload={
            "ocupado": occupied,
            "occupied": occupied,
            "estado": "ocupado" if occupied else "disponible",
            "status": "occupied" if occupied else "available",
        },
        filters=[
            {"column": "id", "value": space_id, "optional": False},
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": False},
        ],
    )


@visitantes_bp.post("/entrada")
@auth_required
def register_visitor_entry():
    payload = request.get_json(silent=True) or {}
    nombre = str(payload.get("nombre") or "").strip()
    placa = normalize_plate(payload.get("placa"))
    modelo = str(payload.get("modelo") or "").strip()
    cedula = str(payload.get("cedula") or "").strip()
    telefono = str(payload.get("telefono") or "").strip()
    espacio_id = payload.get("espacio_id")
    notas = str(payload.get("notas") or "").strip()

    try:
        duracion_estimada = int(payload.get("duracion_estimada")) if payload.get("duracion_estimada") not in (None, "") else None
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "duracion_estimada debe ser un entero en minutos"}), 400

    if not nombre:
        return jsonify({"success": False, "error": "El nombre es requerido"}), 400
    if not placa:
        return jsonify({"success": False, "error": "La placa es requerida"}), 400
    if not validate_plate(placa):
        return jsonify({"success": False, "error": "La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"}), 400
    if not espacio_id:
        return jsonify({"success": False, "error": "espacio_id es requerido"}), 400

    if str(espacio_id) not in _garage_spaces_index():
        return jsonify({"success": False, "error": "El espacio no pertenece a este garage"}), 400

    active = select_rows(
        "visitors",
        filters=[
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": False},
            {"column": "placa", "value": placa, "optional": False},
            {"column": "estado", "value": "dentro", "optional": False},
        ],
        order_candidates=["entrada", "created_at"],
        desc=True,
        limit=1,
    )
    if active:
        return jsonify({"success": False, "error": "Ya existe un visitante activo con esa placa"}), 400

    created = insert_row(
        "visitors",
        {
            "garage_id": g.current_user_garage_id,
            "nombre": nombre,
            "cedula": cedula or None,
            "telefono": telefono or None,
            "placa": placa,
            "modelo": modelo or None,
            "espacio_id": espacio_id,
            "entrada": utcnow_iso(),
            "duracion_estimada": duracion_estimada,
            "notas": notas or None,
            "estado": "dentro",
            "created_at": utcnow_iso(),
        },
    )
    if not created.get("id"):
        return jsonify({"success": False, "error": "La tabla visitors no esta disponible todavia en Supabase."}), 500

    _set_space_status(str(espacio_id), "ocupado")

    visitor = _normalize_visitor(created, _garage_spaces_index())
    return jsonify({"success": True, "message": "Visitante registrado correctamente", "data": visitor}), 201


@visitantes_bp.post("/salida")
@auth_required
def register_visitor_exit():
    payload = request.get_json(silent=True) or {}
    placa = str(payload.get("placa") or "").strip().upper()

    if not placa:
        return jsonify({"success": False, "error": "La placa es requerida"}), 400

    active_rows = select_rows(
        "visitors",
        filters=[
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": False},
            {"column": "placa", "value": placa, "optional": False},
            {"column": "estado", "value": "dentro", "optional": False},
        ],
        order_candidates=["entrada", "created_at"],
        desc=True,
        limit=1,
    )

    if not active_rows:
        return jsonify({"success": False, "error": "No existe un visitante activo con esa placa"}), 404

    current = active_rows[0]
    updated_rows = update_rows(
        "visitors",
        payload={
            "salida": utcnow_iso(),
            "estado": "fuera",
        },
        filters=[
            {"column": "id", "value": current.get("id"), "optional": False},
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": False},
        ],
    )
    updated = updated_rows[0] if updated_rows else {**current, "salida": utcnow_iso(), "estado": "fuera"}
    _set_space_status(str(current.get("espacio_id") or ""), "disponible")
    visitor = _normalize_visitor(updated, _garage_spaces_index())
    return jsonify({"success": True, "message": "Salida registrada correctamente", "data": visitor}), 200


@visitantes_bp.get("/activos")
@auth_required
def list_active_visitors():
    rows = select_rows(
        "visitors",
        filters=[
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": False},
            {"column": "estado", "value": "dentro", "optional": False},
        ],
        order_candidates=["entrada", "created_at"],
        desc=True,
    )
    spaces_by_id = _garage_spaces_index()
    visitors = [_normalize_visitor(row, spaces_by_id) for row in rows]
    pagination = get_pagination_params()
    if not pagination["enabled"]:
        return jsonify({"success": True, "data": visitors}), 200
    page_rows, meta = paginate_items(visitors, page=pagination["page"], page_size=pagination["page_size"])
    return jsonify({"success": True, "data": page_rows, "meta": meta}), 200


@visitantes_bp.get("/historial")
@auth_required
def list_visitor_history():
    rows = select_rows(
        "visitors",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
        order_candidates=["entrada", "created_at"],
        desc=True,
        limit=100,
    )
    spaces_by_id = _garage_spaces_index()
    visitors = [_normalize_visitor(row, spaces_by_id) for row in rows]
    pagination = get_pagination_params()
    if not pagination["enabled"]:
        return jsonify({"success": True, "data": visitors}), 200
    page_rows, meta = paginate_items(visitors, page=pagination["page"], page_size=pagination["page_size"])
    return jsonify({"success": True, "data": page_rows, "meta": meta}), 200
