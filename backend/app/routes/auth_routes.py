"""Authentication API using custom SMTP OTP verification and Supabase."""

from __future__ import annotations

import os
import secrets
import threading
import time
import traceback
from typing import Any

from flask import Blueprint, jsonify, request, session

from app.authz import requires_role
from app.garage_context import get_current_garage
from app.routes.notificaciones_routes import crear_notificacion
from app.services.otp_service import otp_service
from app.supabase_client import (
    admin_exists,
    activar_usuario_auth,
    cambiar_password_usuario,
    cerrar_sesion,
    eliminar_cuenta_usuario,
    ensure_user_role_and_garage,
    enviar_codigo_verificacion,
    get_user_garage_id,
    get_user_role,
    get_supabase_admin_client,
    listar_login_sessions,
    login_usuario,
    obtener_configuracion_usuario,
    guardar_configuracion_usuario,
    registrar_evento_auth,
    registrar_login_session,
    registrar_usuario_registrado,
    subir_foto_perfil,
    update_auth_user_role,
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

OTP_TTL_SECONDS = int(os.getenv('OTP_TTL_SECONDS', '600'))
MAX_VERIFY_ATTEMPTS = int(os.getenv('OTP_MAX_ATTEMPTS', '5'))

PENDING_REGISTRATIONS: dict[str, dict[str, Any]] = {}
PENDING_LOCK = threading.Lock()


def _generate_code() -> str:
    return f'{secrets.randbelow(1_000_000):06d}'


def _create_pending_registration(email: str, full_name: str, password: str) -> str:
    otp = otp_service.generar_codigo(email=email, tipo='registro')
    code = str(otp.get('codigo') or _generate_code())
    now = int(time.time())
    with PENDING_LOCK:
        PENDING_REGISTRATIONS[email] = {
            'full_name': full_name,
            'password': password,
            'code': code,
            'expires_at': now + OTP_TTL_SECONDS,
            'attempts': 0,
        }
    return code


def _get_pending(email: str) -> dict[str, Any] | None:
    with PENDING_LOCK:
        return PENDING_REGISTRATIONS.get(email)


def _delete_pending(email: str) -> None:
    with PENDING_LOCK:
        PENDING_REGISTRATIONS.pop(email, None)


def _get_payload() -> dict[str, Any]:
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        return payload
    return request.form.to_dict()


def _build_error(message: str, status: int = 400) -> tuple[dict[str, str], int]:
    return ({'error': message}, status)


def _registrar_alerta_acceso(
    *,
    user_id: str | None = None,
    email: str | None = None,
    rol: str | None = None,
    ruta_denegada: str | None = None,
    tipo: str = 'acceso_denegado',
) -> None:
    client = get_supabase_admin_client()
    denied_path = (ruta_denegada or '').strip()
    email_value = (email or '').strip().lower() or None
    alert_type = (tipo or 'acceso_denegado').strip().lower()

    if client is None or not denied_path or not email_value:
        return

    role_value = (rol or '').strip() or session.get('role') or None
    if (not role_value or role_value == 'desconocido') and user_id:
        try:
            role_value = get_user_role(user_id)
        except Exception:
            role_value = role_value or None

    payload = {
        'user_id': user_id,
        'email': email_value,
        'rol': role_value or 'desconocido',
        'ruta_denegada': denied_path,
        'tipo': alert_type if alert_type in {'acceso_denegado', 'login_fallido'} else 'acceso_denegado',
    }

    try:
        client.table('alertas_acceso').insert(payload).execute()
    except Exception:
        # Compatibilidad temporal si la columna `tipo` todavÃ­a no existe en Supabase.
        fallback_payload = dict(payload)
        fallback_payload.pop('tipo', None)
        client.table('alertas_acceso').insert(fallback_payload).execute()

def _registrar_login_fallido(email: str) -> None:
    normalized_email = (email or '').strip().lower()
    if not normalized_email:
        return

    try:
        registrar_evento_auth(email=normalized_email, evento='login_failed')
    except Exception:
        traceback.print_exc()

    try:
        _registrar_alerta_acceso(
            email=normalized_email,
            ruta_denegada='/login',
            tipo='login_fallido',
        )
    except Exception:
        traceback.print_exc()

    try:
        crear_notificacion(
            titulo='Intento de login fallido',
            mensaje=f'Se registró un intento fallido con el correo {normalized_email}.',
            tipo='warning',
            email=normalized_email,
        )
    except Exception:
        traceback.print_exc()

@auth_bp.post('/login')
def login_post() -> tuple[dict[str, Any], int]:
    payload = _get_payload()
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''

    if not email or not password:
        return _build_error('Email y password son requeridos.', 400)

    try:
        result = login_usuario(email=email, password=password)
        user_id = result.get('user_id')

        if not user_id:
            _registrar_login_fallido(email)
            return _build_error('No fue posible iniciar sesion.', 401)

        sync_data = ensure_user_role_and_garage(
            user_id,
            email=result.get('email') or email,
            default_role='usuario',
        )

        session['user_id'] = user_id
        session['email'] = sync_data.get('email') or result.get('email') or email
        session['access_token'] = result.get('access_token')
        session['refresh_token'] = result.get('refresh_token')
        session['role'] = sync_data.get('role') or get_user_role(user_id)
        session['garage_id'] = sync_data.get('garage_id') or result.get('garage_id') or get_user_garage_id(user_id)
        session.pop('pending_email', None)

        try:
            ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ip_address and ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()
            registrar_login_session(
                user_id=user_id,
                email=session['email'],
                ip_address=ip_address,
                user_agent=request.headers.get('User-Agent'),
            )
        except Exception:
            pass

        return (
            {
                'mensaje': 'Inicio de sesion exitoso',
                'user_id': user_id,
                'email': session['email'],
                'role': session['role'],
                'garage_id': session.get('garage_id'),
            },
            200,
        )
    except Exception as exc:
        traceback.print_exc()
        message = str(exc)
        _registrar_login_fallido(email)
        if 'Invalid login credentials' in message:
            return ({'error': 'Correo o contraseña incorrectos.'}, 401)
        return ({'error': message}, 500)


@auth_bp.post('/register')
def register_post() -> tuple[dict[str, Any], int]:
    payload = _get_payload()
    full_name = (payload.get('full_name') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    confirm_password = payload.get('confirm_password') or ''

    if not full_name or not email or not password or not confirm_password:
        return _build_error('Nombre completo, gmail, password y confirmar password son requeridos.', 400)

    if password != confirm_password:
        return _build_error('Las contrasenas no coinciden.', 400)

    if len(password) < 6:
        return _build_error('La password debe tener al menos 6 caracteres.', 400)

    try:
        code = _create_pending_registration(email=email, full_name=full_name, password=password)
        enviar_codigo_verificacion(email=email, codigo=code, full_name=full_name)
        session['pending_email'] = email
        try:
            registrar_evento_auth(email=email, evento='register_requested')
        except Exception:
            pass
        return ({'mensaje': 'Codigo enviado', 'email': email}, 201)
    except Exception as exc:
        traceback.print_exc()
        _delete_pending(email)
        return _build_error(f'No se pudo enviar el codigo de verificacion: {str(exc)}', 500)


@auth_bp.post('/verify')
def verify_post() -> tuple[dict[str, Any], int]:
    payload = _get_payload()
    email = (payload.get('email') or '').strip().lower()
    token = (payload.get('token') or '').strip()

    if not email or not token:
        return _build_error('Email y codigo OTP son requeridos.', 400)

    pending = _get_pending(email)
    if pending is None:
        return _build_error('No hay una verificacion pendiente para este correo.', 404)

    now = int(time.time())
    if now > int(pending.get('expires_at', 0)):
        _delete_pending(email)
        return _build_error('El codigo expiro. Solicita uno nuevo.', 400)

    if pending.get('attempts', 0) >= MAX_VERIFY_ATTEMPTS:
        _delete_pending(email)
        return _build_error('Superaste el maximo de intentos. Solicita un nuevo codigo.', 400)

    try:
        otp_service.verificar_codigo(email=email, codigo=token, tipo='registro')
    except LookupError:
        with PENDING_LOCK:
            if email in PENDING_REGISTRATIONS:
                PENDING_REGISTRATIONS[email]['attempts'] = int(
                    PENDING_REGISTRATIONS[email].get('attempts', 0)
                ) + 1
        return _build_error('Codigo incorrecto. Verifica e intenta nuevamente.', 401)
    except TimeoutError:
        _delete_pending(email)
        return _build_error('El codigo expiro. Solicita uno nuevo.', 400)
    except Exception as exc:
        return _build_error(f'No se pudo validar el codigo OTP: {str(exc)}', 500)

    full_name = str(pending.get('full_name', '')).strip()
    password = str(pending.get('password', ''))

    try:
        admin_client = get_supabase_admin_client()
        if admin_client is not None:
            attrs: dict[str, Any] = {
                'email': email,
                'password': password,
                'email_confirm': True,
                'user_metadata': {
                    'role': 'usuario',
                    'full_name': full_name,
                },
            }
            try:
                created = admin_client.auth.admin.create_user(attrs)
                user_obj = getattr(created, 'user', None)
                user_id = getattr(user_obj, 'id', None)
            except Exception as exc:
                message = str(exc)
                if 'already been registered' in message.lower():
                    listed = admin_client.auth.admin.list_users()
                    candidates = getattr(listed, 'users', None) or listed or []
                    user_id = None
                    for user_obj in candidates:
                        if (getattr(user_obj, 'email', None) or '').strip().lower() == email:
                            user_id = getattr(user_obj, 'id', None)
                            break
                    if not user_id:
                        raise
                    admin_client.auth.admin.update_user_by_id(
                        user_id,
                        {
                            'password': password,
                            'email_confirm': True,
                            'user_metadata': {
                                'role': 'usuario',
                                'full_name': full_name,
                            },
                        },
                    )
                else:
                    raise
        else:
            activation = activar_usuario_auth(email=email, password=password, full_name=full_name)
            user_id = activation.get('user_id')

        sync_data = ensure_user_role_and_garage(
            user_id,
            email=email,
            full_name=full_name,
            default_role='usuario',
        )

        try:
            registrar_usuario_registrado(
                user_id=user_id,
                email=email,
                nombre=full_name,
                ip_address=(request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or request.remote_addr),
                user_agent=request.headers.get('User-Agent'),
            )
        except Exception:
            print(f'Error guardando en registros_usuarios para {email}')
            print(traceback.format_exc())

        _delete_pending(email)
        session.pop('pending_email', None)

        try:
            registrar_evento_auth(email=email, evento='register_verified')
        except Exception:
            pass

        return (
            {
                'mensaje': 'Cuenta verificada. Ahora puedes iniciar sesion.',
                'user_id': user_id,
                'email': email,
                'role': sync_data.get('role'),
                'garage_id': sync_data.get('garage_id'),
            },
            200,
        )
    except Exception as exc:
        message = str(exc)
        print(f'Error principal en /api/auth/verify para {email}: {message}')
        print(traceback.format_exc())
        return _build_error(f'No se pudo verificar y activar la cuenta: {message}', 500)


@auth_bp.post('/verify/resend')
def verify_resend() -> tuple[dict[str, Any], int]:
    payload = _get_payload()
    email = (payload.get('email') or session.get('pending_email') or '').strip().lower()

    if not email:
        return _build_error('Debes indicar el email para reenviar el codigo.', 400)

    pending = _get_pending(email)
    if pending is None:
        return _build_error('No hay un registro pendiente para este correo.', 404)

    full_name = str(pending.get('full_name', '')).strip()
    try:
        code = _create_pending_registration(
            email=email,
            full_name=full_name,
            password=str(pending.get('password', '')),
        )
        enviar_codigo_verificacion(email=email, codigo=code, full_name=full_name)
        session['pending_email'] = email
        return ({'mensaje': 'Te reenviamos un nuevo codigo OTP.', 'email': email}, 200)
    except Exception as exc:
        return _build_error(f'No se pudo reenviar el codigo: {str(exc)}', 500)


@auth_bp.post('/logout')
def logout() -> tuple[dict[str, str], int]:
    access_token = session.get('access_token')
    refresh_token = session.get('refresh_token')
    try:
        cerrar_sesion(access_token=access_token, refresh_token=refresh_token)
    except Exception:
        pass
    session.clear()
    return ({'mensaje': 'Sesion cerrada'}, 200)


@auth_bp.get('/settings')
def get_settings() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    email = session.get('email')
    if not user_id:
        return _build_error('No autenticado.', 401)
    try:
        garage_id = get_current_garage(required=False)
        settings = obtener_configuracion_usuario(str(user_id), email, garage_id)
        session['role'] = settings.get('role')
        session['garage_id'] = settings.get('garage_id') or garage_id
        return ({'data': settings}, 200)
    except RuntimeError as exc:
        return _build_error(str(exc), 403)
    except Exception as exc:
        return _build_error(f'No se pudo cargar la configuracion: {str(exc)}', 500)


@auth_bp.put('/settings')
def save_settings() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    email = session.get('email')
    if not user_id:
        return _build_error('No autenticado.', 401)

    if request.content_type and 'multipart/form-data' in request.content_type:
        payload = request.form.to_dict()
    else:
        payload = _get_payload()

    full_name = (payload.get('full_name') or '').strip()
    phone = (payload.get('phone') or '').strip()
    company_name = (payload.get('company_name') or '').strip()
    company_address = (payload.get('company_address') or '').strip()
    company_phone = (payload.get('company_phone') or '').strip()
    hourly_rate_raw = str(payload.get('hourly_rate') or '').strip()
    avatar_url = (payload.get('avatar_url') or '').strip() or None
    hourly_rate = None
    if hourly_rate_raw:
        try:
            hourly_rate = float(hourly_rate_raw)
        except ValueError:
            return _build_error('La tarifa por hora debe ser un numero valido.', 400)

    avatar_file = request.files.get('avatar') if request.files else None

    try:
        garage_id = get_current_garage(required=True)
        if avatar_file and getattr(avatar_file, 'filename', ''):
            avatar_url = subir_foto_perfil(str(user_id), avatar_file)

        data = guardar_configuracion_usuario(
            user_id=str(user_id),
            garage_id=garage_id,
            email=email,
            full_name=full_name or None,
            phone=phone or None,
            avatar_url=avatar_url,
            company_name=company_name or None,
            company_address=company_address or None,
            company_phone=company_phone or None,
            hourly_rate=hourly_rate,
        )
        session['role'] = data.get('role')
        session['garage_id'] = data.get('garage_id') or garage_id
        return ({'mensaje': 'Cambios guardados correctamente.', 'data': data}, 200)
    except RuntimeError as exc:
        return _build_error(str(exc), 403)
    except Exception as exc:
        print(traceback.format_exc())
        return _build_error(f'No se pudo guardar la configuracion: {str(exc)}', 500)


@auth_bp.post('/change-password')
def change_password() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    if not user_id:
        return _build_error('No autenticado.', 401)

    payload = _get_payload()
    new_password = str(payload.get('new_password') or '')
    confirm_password = str(payload.get('confirm_password') or '')

    if not new_password or not confirm_password:
        return _build_error('Debes completar la nueva contrasena y su confirmacion.', 400)
    if new_password != confirm_password:
        return _build_error('Las contrasenas no coinciden.', 400)
    if len(new_password) < 6:
        return _build_error('La contrasena debe tener al menos 6 caracteres.', 400)

    try:
        cambiar_password_usuario(
            access_token=session.get('access_token'),
            refresh_token=session.get('refresh_token'),
            new_password=new_password,
        )
        return ({'mensaje': 'Contrasena actualizada correctamente.'}, 200)
    except Exception as exc:
        return _build_error(f'No se pudo actualizar la contrasena: {str(exc)}', 500)


@auth_bp.post('/delete-account')
def delete_account() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    access_token = session.get('access_token')
    refresh_token = session.get('refresh_token')
    if not user_id:
        return _build_error('No autenticado.', 401)

    try:
        eliminar_cuenta_usuario(str(user_id))
    except Exception as exc:
        return _build_error(f'No se pudo eliminar la cuenta: {str(exc)}', 500)

    try:
        cerrar_sesion(access_token=access_token, refresh_token=refresh_token)
    except Exception:
        pass
    session.clear()
    return ({'mensaje': 'Cuenta eliminada correctamente.'}, 200)


@auth_bp.get('/login-sessions')
@requires_role('admin')
def get_login_sessions() -> tuple[dict[str, Any], int]:
    try:
        sessions = listar_login_sessions()
        return ({'data': sessions}, 200)
    except Exception as exc:
        return _build_error(f'No se pudieron cargar las sesiones de acceso: {str(exc)}', 500)


@auth_bp.get('/me')
def current_user() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    if not user_id:
        return ({'user': None}, 200)
    email = session.get('email')
    synced = ensure_user_role_and_garage(
        str(user_id),
        email=email,
        default_role=session.get('role') or 'usuario',
    )
    role = synced.get('role') or get_user_role(str(user_id))
    garage_id = synced.get('garage_id') or get_user_garage_id(str(user_id))
    session['role'] = role
    session['garage_id'] = garage_id
    profile = obtener_configuracion_usuario(str(user_id), email, garage_id)
    return (
        {
            'user': {
                'user_id': user_id,
                'garage_id': profile.get('garage_id') or garage_id,
                'email': profile.get('email') or email,
                'name': profile.get('name'),
                'full_name': profile.get('full_name') or profile.get('name'),
                'phone': profile.get('phone'),
                'avatar_url': profile.get('avatar_url'),
                'role': profile.get('role') or role,
            },
        },
        200,
    )


@auth_bp.post('/setup-admin')
def setup_admin() -> tuple[dict[str, Any], int]:
    user_id = session.get('user_id')
    email = session.get('email')
    if not user_id or not email:
        return _build_error('Debes iniciar sesion para completar la configuracion inicial.', 401)

    try:
        if admin_exists():
            return _build_error('Ya existe un administrador configurado en el sistema.', 403)
        updated = update_auth_user_role(user_id, 'admin')
        session['role'] = 'admin'
        return ({'mensaje': 'Administrador inicial configurado correctamente.', 'data': updated}, 200)
    except Exception as exc:
        return _build_error(f'No se pudo configurar el administrador inicial: {str(exc)}', 500)


@auth_bp.post('/alertas-acceso')
def registrar_alerta_acceso():
    payload = _get_payload()

    user_id = session.get('user_id') or payload.get('user_id')
    email = session.get('email') or payload.get('email')
    role = session.get('role') or payload.get('rol')
    denied_path = (payload.get('ruta_denegada') or '').strip()

    if not denied_path or not email:
        return jsonify({'error': 'email y ruta_denegada son requeridos.'}), 400

    try:
        _registrar_alerta_acceso(
            user_id=user_id,
            email=email,
            rol=role,
            ruta_denegada=denied_path,
            tipo=payload.get('tipo') or 'acceso_denegado',
        )
        return jsonify({'mensaje': 'Alerta registrada.'}), 201
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': str(exc)}), 500


@auth_bp.get('/alertas-acceso')
@requires_role('admin')
def listar_alertas_acceso():
    client = get_supabase_admin_client()
    if client is None:
        return jsonify({'error': 'No fue posible conectar con Supabase.'}), 500

    try:
        response = (
            client.table('alertas_acceso')
            .select('*')
            .order('created_at', desc=True)
            .execute()
        )
        return jsonify({'data': response.data or []}), 200
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': str(exc)}), 500


