from __future__ import annotations

from typing import Any

from flask import Blueprint, jsonify, request, session

from app.authz import requires_role
from app.garage_context import get_current_garage
from app.supabase_client import get_supabase_admin_client, get_user_garage_id

notificaciones_bp = Blueprint('notificaciones', __name__, url_prefix='/api/notificaciones')


def _is_missing_notificaciones_table_error(error: Exception) -> bool:
    message = str(error)
    lowered = message.lower()
    return 'notificaciones' in lowered and (
        "could not find the table 'public.notificaciones'" in lowered
        or 'schema cache' in lowered
        or 'pgrst205' in lowered
    )


def _resolve_garage_id_for_notification(
    *,
    garage_id: str | None = None,
    email: str | None = None,
) -> str | None:
    resolved = (garage_id or session.get('garage_id') or request.headers.get('X-Garage-ID') or '').strip()
    if resolved:
        return resolved

    normalized_email = (email or '').strip().lower()
    if not normalized_email:
        return None

    client = get_supabase_admin_client()
    if client is None:
        return None

    listed = client.auth.admin.list_users()
    users = getattr(listed, 'users', None) or listed or []
    for user_obj in users:
        candidate_email = (getattr(user_obj, 'email', None) or '').strip().lower()
        if candidate_email != normalized_email:
            continue
        user_id = getattr(user_obj, 'id', None)
        if not user_id:
            return None
        return get_user_garage_id(str(user_id))

    return None


def crear_notificacion(
    *,
    garage_id: str | None = None,
    titulo: str,
    mensaje: str | None = None,
    tipo: str = 'info',
    email: str | None = None,
) -> dict[str, Any] | None:
    client = get_supabase_admin_client()
    if client is None:
        return None

    resolved_garage_id = _resolve_garage_id_for_notification(garage_id=garage_id, email=email)
    payload = {
        'garage_id': resolved_garage_id,
        'titulo': titulo,
        'mensaje': mensaje,
        'tipo': (tipo or 'info').strip().lower() or 'info',
        'leida': False,
    }

    try:
        response = client.table('notificaciones').insert(payload).execute()
        data = response.data or []
        return data[0] if data else payload
    except Exception as exc:
        if _is_missing_notificaciones_table_error(exc):
            return None
        raise


@notificaciones_bp.route('', methods=['GET'], strict_slashes=False)
@requires_role('admin', 'portero', 'usuario')
def listar_notificaciones():
    client = get_supabase_admin_client()
    if client is None:
        return jsonify({'error': 'No fue posible conectar con Supabase.'}), 500

    try:
        garage_id = get_current_garage(required=True)
        response = (
            client.table('notificaciones')
            .select('*')
            .eq('garage_id', garage_id)
            .order('created_at', desc=True)
            .execute()
        )
        return jsonify({'data': response.data or []}), 200
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except Exception as exc:
        if _is_missing_notificaciones_table_error(exc):
            return jsonify({'data': []}), 200
        return jsonify({'error': str(exc)}), 500


@notificaciones_bp.route('', methods=['POST'], strict_slashes=False)
@requires_role('admin', 'portero', 'usuario')
def registrar_notificacion():
    client = get_supabase_admin_client()
    if client is None:
        return jsonify({'error': 'No fue posible conectar con Supabase.'}), 500

    payload = request.get_json(silent=True) or {}
    titulo = (payload.get('titulo') or '').strip()
    mensaje = (payload.get('mensaje') or '').strip() or None
    tipo = (payload.get('tipo') or 'info').strip().lower() or 'info'

    if not titulo:
        return jsonify({'error': 'El titulo es requerido.'}), 400

    try:
        garage_id = get_current_garage(required=True)
        data = crear_notificacion(
            garage_id=garage_id,
            titulo=titulo,
            mensaje=mensaje,
            tipo=tipo,
        )
        return jsonify({'data': data, 'mensaje': 'Notificacion creada.'}), 201
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except Exception as exc:
        if _is_missing_notificaciones_table_error(exc):
            return jsonify({'data': None, 'mensaje': 'Notificaciones deshabilitadas temporalmente.'}), 201
        return jsonify({'error': str(exc)}), 500


@notificaciones_bp.patch('/<notificacion_id>/leer')
@requires_role('admin', 'portero', 'usuario')
def marcar_notificacion_leida(notificacion_id: str):
    client = get_supabase_admin_client()
    if client is None:
        return jsonify({'error': 'No fue posible conectar con Supabase.'}), 500

    try:
        garage_id = get_current_garage(required=True)
        response = (
            client.table('notificaciones')
            .update({'leida': True})
            .eq('id', notificacion_id)
            .eq('garage_id', garage_id)
            .execute()
        )
        return jsonify({'data': response.data or [], 'mensaje': 'Notificacion marcada como leida.'}), 200
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except Exception as exc:
        if _is_missing_notificaciones_table_error(exc):
            return jsonify({'data': [], 'mensaje': 'Notificaciones deshabilitadas temporalmente.'}), 200
        return jsonify({'error': str(exc)}), 500


@notificaciones_bp.patch('/leer-todas')
@requires_role('admin', 'portero', 'usuario')
def marcar_todas_leidas():
    client = get_supabase_admin_client()
    if client is None:
        return jsonify({'error': 'No fue posible conectar con Supabase.'}), 500

    try:
        garage_id = get_current_garage(required=True)
        response = (
            client.table('notificaciones')
            .update({'leida': True})
            .eq('garage_id', garage_id)
            .eq('leida', False)
            .execute()
        )
        return jsonify({'data': response.data or [], 'mensaje': 'Todas las notificaciones fueron marcadas como leidas.'}), 200
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except Exception as exc:
        if _is_missing_notificaciones_table_error(exc):
            return jsonify({'data': [], 'mensaje': 'Notificaciones deshabilitadas temporalmente.'}), 200
        return jsonify({'error': str(exc)}), 500
