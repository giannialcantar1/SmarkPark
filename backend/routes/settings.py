from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Blueprint, g, jsonify, request

from config import Config
from utils.decorators import auth_required
from utils.supabase_client import (
    get_supabase_admin_client,
    get_user_table_client,
    insert_row,
    select_rows,
    update_rows,
    utcnow_iso,
)


settings_bp = Blueprint("settings", __name__, url_prefix="/api")


def _metadata(user: Any) -> dict[str, Any]:
    data = getattr(user, "user_metadata", None) or {}
    return data if isinstance(data, dict) else {}


def _auth_user(user_id: str | None) -> Any:
    if not user_id:
        return None
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return None
    try:
        response = admin_client.auth.admin.get_user_by_id(user_id)
        return getattr(response, "user", None)
    except Exception:
        return None


def _first(*values: Any, default: Any = "") -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return default


def _load_settings(user_id: str, garage_id: str | None) -> dict[str, Any]:
    rows = select_rows(
        "settings",
        filters=[
            {"column": "user_id", "value": user_id, "optional": True},
            {"column": "garage_id", "value": garage_id, "optional": True},
        ],
        order_candidates=["updated_at", "created_at"],
        desc=True,
        limit=1,
    )
    if rows:
        return rows[0]

    rows = select_rows(
        "settings",
        filters=[{"column": "user_id", "value": user_id, "optional": True}],
        order_candidates=["updated_at", "created_at"],
        desc=True,
        limit=1,
    )
    return rows[0] if rows else {}


def _settings_payload(row: dict[str, Any], user: Any = None) -> dict[str, Any]:
    meta = _metadata(user)
    email = _first(getattr(user, "email", None), g.get("current_user_email"), row.get("email"))
    full_name = _first(
        meta.get("full_name"),
        meta.get("name"),
        meta.get("nombre"),
        row.get("full_name"),
        row.get("name"),
        row.get("nombre"),
    )
    phone = _first(meta.get("phone"), row.get("user_phone"), row.get("telefono_usuario"), row.get("telefono"))
    avatar_url = _first(meta.get("avatar_url"), row.get("avatar_url"), row.get("foto_url"))
    company_name = _first(row.get("company_name"), row.get("nombre_empresa"), row.get("empresa"))
    company_address = _first(row.get("address"), row.get("company_address"), row.get("direccion"))
    company_phone = _first(row.get("company_phone"), row.get("phone"), row.get("telefono_empresa"))
    hourly_rate = _first(row.get("hourly_rate"), row.get("tarifa_hora"), default=Config.DEFAULT_HOURLY_RATE)
    role = _first(meta.get("role"), meta.get("rol"), g.get("current_user_role"), row.get("role"), row.get("rol"), default="usuario")
    garage_id = _first(row.get("garage_id"), meta.get("garage_id"), g.get("current_user_garage_id"), default=Config.DEFAULT_GARAGE_ID)

    return {
        "user_id": g.current_user_id,
        "garage_id": garage_id,
        "staff_invitation_code": garage_id,
        "staffInvitationCode": garage_id,
        "invitation_code": garage_id,
        "email": email,
        "name": full_name,
        "full_name": full_name,
        "nombre": full_name,
        "nombreCompleto": full_name,
        "phone": phone,
        "telefono": phone,
        "avatar_url": avatar_url,
        "avatarUrl": avatar_url,
        "role": role,
        "rol": role,
        "two_factor_enabled": bool(meta.get("two_factor_enabled") or row.get("two_factor_enabled")),
        "twoFactorEnabled": bool(meta.get("two_factor_enabled") or row.get("two_factor_enabled")),
        "company_name": company_name,
        "company_address": company_address,
        "company_phone": company_phone,
        "empresa": company_name,
        "nombreEmpresa": company_name,
        "direccion": company_address,
        "telefonoEmpresa": company_phone,
        "telefono_empresa": company_phone,
        "hourly_rate": hourly_rate,
        "tarifaHora": hourly_rate,
        "tarifa_hora": hourly_rate,
    }


def _request_payload() -> dict[str, Any]:
    if request.content_type and "multipart/form-data" in request.content_type:
        return request.form.to_dict()
    return request.get_json(silent=True) or {}


def _parse_rate(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError("La tarifa por hora debe ser un numero valido.")


def _upload_avatar(user_id: str, file_storage: Any) -> str:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY es requerida para subir la foto de perfil.")

    filename = getattr(file_storage, "filename", "") or "avatar.png"
    extension = Path(filename).suffix or ".png"
    object_path = f"{user_id}/avatar-{int(datetime.now(timezone.utc).timestamp())}{extension}"
    content = file_storage.read()
    if not content:
        raise RuntimeError("La imagen seleccionada esta vacia.")

    bucket_name = "user-photos"
    try:
        buckets = admin_client.storage.list_buckets()
        exists = any(getattr(bucket, "id", None) == bucket_name or getattr(bucket, "name", None) == bucket_name for bucket in buckets)
        if not exists:
            admin_client.storage.create_bucket(bucket_name, options={"public": True})
    except Exception:
        pass

    admin_client.storage.from_(bucket_name).upload(
        object_path,
        content,
        file_options={
            "content-type": getattr(file_storage, "mimetype", None) or "application/octet-stream",
            "upsert": "true",
        },
    )
    return admin_client.storage.from_(bucket_name).get_public_url(object_path)


def _save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    existing = select_rows(
        "settings",
        filters=[
            {"column": "user_id", "value": payload.get("user_id"), "optional": True},
            {"column": "garage_id", "value": payload.get("garage_id"), "optional": True},
        ],
        limit=1,
    )
    if existing and existing[0].get("id"):
        rows = update_rows("settings", payload=payload, filters=[{"column": "id", "value": existing[0]["id"]}])
        return rows[0] if rows else {**existing[0], **payload}

    payload = {**payload, "created_at": utcnow_iso()}
    return insert_row("settings", payload)


@settings_bp.get("/configuracion")
@settings_bp.get("/auth/settings")
@auth_required
def get_settings():
    user = _auth_user(g.current_user_id)
    settings_row = _load_settings(g.current_user_id, g.current_user_garage_id)
    return jsonify({"success": True, "data": _settings_payload(settings_row, user)})


@settings_bp.put("/configuracion")
@settings_bp.put("/auth/settings")
@auth_required
def update_settings():
    body = _request_payload()
    try:
        hourly_rate = _parse_rate(_first(body.get("hourly_rate"), body.get("tarifaHora"), body.get("tarifa_hora"), default=None))
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return jsonify({"success": False, "error": "SUPABASE_SERVICE_ROLE_KEY es requerida para actualizar configuracion."}), 500

    user = _auth_user(g.current_user_id)
    current_meta = _metadata(user)
    full_name = _first(body.get("full_name"), body.get("nombre"), body.get("nombreCompleto"), current_meta.get("full_name"))
    phone = _first(body.get("phone"), body.get("telefono"), current_meta.get("phone"))
    avatar_url = _first(body.get("avatar_url"), body.get("avatarUrl"), current_meta.get("avatar_url"))

    avatar_file = request.files.get("avatar") if request.files else None
    if avatar_file and getattr(avatar_file, "filename", ""):
        avatar_url = _upload_avatar(g.current_user_id, avatar_file)

    next_meta = {
        **current_meta,
        "name": full_name,
        "full_name": full_name,
        "phone": phone,
        "avatar_url": avatar_url,
        "garage_id": g.current_user_garage_id,
        "role": _first(current_meta.get("role"), g.current_user_role, default="usuario"),
    }
    admin_client.auth.admin.update_user_by_id(g.current_user_id, {"user_metadata": next_meta})

    company_name = _first(body.get("company_name"), body.get("empresa"), body.get("nombreEmpresa"))
    company_address = _first(body.get("company_address"), body.get("direccion"))
    company_phone = _first(body.get("company_phone"), body.get("telefonoEmpresa"), body.get("telefono_empresa"))

    settings_row = _save_settings(
        {
            "user_id": g.current_user_id,
            "garage_id": g.current_user_garage_id,
            "company_name": company_name,
            "address": company_address,
            "phone": company_phone,
            "avatar_url": avatar_url,
            "hourly_rate": hourly_rate,
            "updated_at": utcnow_iso(),
        }
    )
    data = _settings_payload(settings_row, _auth_user(g.current_user_id))
    return jsonify({"success": True, "mensaje": "Configuracion guardada correctamente.", "data": data})


@settings_bp.post("/configuracion/password")
@settings_bp.post("/auth/change-password")
@auth_required
def change_password():
    body = request.get_json(silent=True) or {}
    password = _first(body.get("new_password"), body.get("password"), body.get("nueva"))
    confirm = _first(body.get("confirm_password"), body.get("confirmar"), password)
    if not password:
        return jsonify({"success": False, "error": "La nueva contrasena es requerida."}), 400
    if password != confirm:
        return jsonify({"success": False, "error": "Las contrasenas no coinciden."}), 400
    if len(str(password)) < 6:
        return jsonify({"success": False, "error": "La contrasena debe tener al menos 6 caracteres."}), 400

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return jsonify({"success": False, "error": "SUPABASE_SERVICE_ROLE_KEY es requerida para cambiar la contrasena."}), 500
    admin_client.auth.admin.update_user_by_id(g.current_user_id, {"password": str(password)})
    return jsonify({"success": True, "mensaje": "Contrasena actualizada correctamente."})


@settings_bp.post("/configuracion/eliminar-cuenta")
@settings_bp.post("/auth/delete-account")
@auth_required
def delete_account():
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return jsonify({"success": False, "error": "SUPABASE_SERVICE_ROLE_KEY es requerida para eliminar cuentas."}), 500

    client = get_user_table_client(use_admin=True)
    for table_name in ("settings", "users"):
        try:
            client.table(table_name).delete().eq("user_id", g.current_user_id).execute()
        except Exception:
            pass
        try:
            client.table(table_name).delete().eq("auth_user_id", g.current_user_id).execute()
        except Exception:
            pass

    admin_client.auth.admin.delete_user(g.current_user_id)
    return jsonify({"success": True, "mensaje": "Cuenta eliminada correctamente."})
