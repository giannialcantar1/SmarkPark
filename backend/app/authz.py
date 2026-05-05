from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from flask import session

from app.supabase_client import get_user_role


def _normalize_role(value: object | None) -> str | None:
    if value is None:
        return None
    role = str(value).strip().lower()
    return role or None


def get_session_role() -> str | None:
    role = _normalize_role(session.get('role'))
    if role:
        return role

    user_id = session.get('user_id')
    if not user_id:
        return None

    role = _normalize_role(get_user_role(str(user_id)))
    if role:
        session['role'] = role
    return role


def requires_role(*allowed_roles: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    normalized_allowed = {_normalize_role(role) for role in allowed_roles if _normalize_role(role)}

    def decorator(view_func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(view_func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user_id = session.get('user_id')
            if not user_id:
                return ({'error': 'No autenticado'}, 401)

            current_role = get_session_role()
            if normalized_allowed and current_role not in normalized_allowed:
                return (
                    {
                        'error': 'No autorizado',
                        'required_roles': sorted(normalized_allowed),
                        'current_role': current_role,
                    },
                    403,
                )

            return view_func(*args, **kwargs)

        return wrapper

    return decorator


requiere_rol = requires_role
