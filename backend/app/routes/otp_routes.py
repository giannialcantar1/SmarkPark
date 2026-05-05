from __future__ import annotations

from flask import Blueprint, request, session

from app.authz import requires_role
from app.services.otp_service import otp_service


otp_bp = Blueprint('otp', __name__, url_prefix='/api/otp')


@otp_bp.post('/generar')
def generar_otp():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get('email') or '').strip().lower()
    tipo = str(payload.get('tipo') or '').strip().lower()
    user_id = payload.get('user_id') or session.get('user_id')

    if not email or not tipo:
        return ({'error': 'Email y tipo son requeridos.'}, 400)

    try:
        otp = otp_service.generar_codigo(email=email, tipo=tipo, user_id=user_id)
    except ValueError as exc:
        return ({'error': str(exc)}, 400)
    except Exception as exc:
        return ({'error': f'No se pudo generar el OTP: {str(exc)}'}, 500)

    return ({'mensaje': 'Codigo OTP generado correctamente.', 'data': otp}, 201)


@otp_bp.post('/verificar')
def verificar_otp():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get('email') or '').strip().lower()
    codigo = str(payload.get('codigo') or '').strip()
    tipo = str(payload.get('tipo') or '').strip().lower()

    if not email or not codigo or not tipo:
        return ({'error': 'Email, codigo y tipo son requeridos.'}, 400)

    try:
        otp = otp_service.verificar_codigo(email=email, codigo=codigo, tipo=tipo)
    except ValueError as exc:
        return ({'error': str(exc)}, 400)
    except LookupError as exc:
        return ({'error': str(exc)}, 404)
    except TimeoutError as exc:
        return ({'error': str(exc)}, 400)
    except Exception as exc:
        return ({'error': f'No se pudo verificar el OTP: {str(exc)}'}, 500)

    return ({'mensaje': 'Codigo OTP valido.', 'data': otp}, 200)


@otp_bp.get('/codigos')
@requires_role('admin')
def listar_codigos():
    try:
        codigos = otp_service.listar_codigos()
    except Exception as exc:
        return ({'error': f'No se pudieron cargar los codigos OTP: {str(exc)}'}, 500)

    return ({'data': codigos}, 200)
