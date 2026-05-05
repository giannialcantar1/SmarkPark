from __future__ import annotations

from flask import Blueprint, jsonify, request, session

from app.authz import requires_role
from app.supabase_client import list_auth_users, update_auth_user_role

user_bp = Blueprint('usuarios', __name__, url_prefix='/api/usuarios')

ALLOWED_ROLES = {'admin', 'portero', 'usuario'}


@user_bp.get('/')
@requires_role('admin')
def list_users() -> tuple:
    users = list_auth_users()
    return jsonify({'data': users}), 200


@user_bp.put('/<user_id>/rol')
@requires_role('admin')
def update_user_role(user_id: str) -> tuple:
    payload = request.get_json(silent=True) or {}
    role = str(payload.get('role') or '').strip().lower()

    if role not in ALLOWED_ROLES:
        return jsonify({'error': 'Rol invalido. Usa admin, portero o usuario.'}), 400

    user = update_auth_user_role(user_id, role)
    if session.get('user_id') == user_id:
        session['role'] = role
    return jsonify({'data': user, 'mensaje': 'Rol actualizado correctamente'}), 200
