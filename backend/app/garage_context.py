from __future__ import annotations

from flask import Flask, g, request, session

from app.supabase_client import get_user_garage_id

GARAGE_HEADER = 'X-Garage-ID'


def resolve_current_garage_id() -> str | None:
    cached = getattr(g, 'current_garage_id', None)
    if cached:
        return cached

    garage_id = (session.get('garage_id') or request.headers.get(GARAGE_HEADER) or '').strip() or None
    user_id = session.get('user_id')

    if user_id:
        resolved = get_user_garage_id(str(user_id)) or garage_id
        if resolved:
            garage_id = str(resolved).strip()
            session['garage_id'] = garage_id

    g.current_garage_id = garage_id
    return garage_id


def get_current_garage(required: bool = True) -> str | None:
    garage_id = resolve_current_garage_id()
    if required and not garage_id:
        raise RuntimeError('No se encontro el garage_id del usuario autenticado.')
    return garage_id


def bind_current_garage(app: Flask) -> None:
    @app.before_request
    def _bind_current_garage() -> None:
        resolve_current_garage_id()
