"""Supabase client and auth helpers for Flask app."""

from __future__ import annotations

import os
import smtplib
from uuid import uuid4
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_ENV_FILE = BASE_DIR / '.env'
ROOT_ENV_FILE = BASE_DIR.parent / '.env'

load_dotenv(BACKEND_ENV_FILE)
load_dotenv(ROOT_ENV_FILE, override=False)


def get_supabase_client() -> Client:
    """Return Supabase client configured with anon key."""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_KEY must be configured in environment variables')

    return create_client(supabase_url, supabase_key)


def get_supabase_admin_client() -> Client | None:
    """Return optional Supabase admin client configured with service role key."""
    supabase_url = os.getenv('SUPABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not service_role_key:
        return None

    return create_client(supabase_url, service_role_key)


def _extract_display_name(user_obj: Any, fallback_email: str | None = None) -> str | None:
    metadata = getattr(user_obj, 'user_metadata', None) or {}
    if isinstance(metadata, dict):
        for key in ('full_name', 'name', 'nombre'):
            value = metadata.get(key)
            if value:
                return str(value)

    return str(fallback_email) if fallback_email else None


def _extract_user_metadata(user_obj: Any) -> dict[str, Any]:
    metadata = getattr(user_obj, 'user_metadata', None) or {}
    return metadata if isinstance(metadata, dict) else {}


def _extract_phone(user_obj: Any) -> str | None:
    metadata = _extract_user_metadata(user_obj)
    for key in ('phone', 'telefono'):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def _extract_avatar_url(user_obj: Any) -> str | None:
    metadata = _extract_user_metadata(user_obj)
    for key in ('avatar_url', 'foto_url', 'profile_photo'):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def _extract_garage_id(user_obj: Any) -> str | None:
    metadata = _extract_user_metadata(user_obj)
    for key in ('garage_id', 'garaje_id'):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def _extract_two_factor_enabled(user_obj: Any) -> bool:
    metadata = _extract_user_metadata(user_obj)
    factors = getattr(user_obj, 'factors', None) or metadata.get('factors') or []
    if isinstance(factors, list) and factors:
        return True

    flag = metadata.get('two_factor_enabled')
    if isinstance(flag, bool):
        return flag
    if isinstance(flag, str):
        return flag.strip().lower() in {'true', '1', 'yes', 'si', 'activo'}
    return False


def _extract_role(user_obj: Any) -> str | None:
    metadata = getattr(user_obj, 'user_metadata', None) or {}
    if isinstance(metadata, dict):
        role = metadata.get('role')
        if role:
            return str(role).strip().lower()

    role = getattr(user_obj, 'role', None)
    if role and str(role).strip().lower() not in {'authenticated', 'anon'}:
        return str(role).strip().lower()
    return None


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    message = str(exc or '')
    normalized = message.lower()
    table = f'public.{table_name}'.lower()
    return (
        f"could not find the table '{table}'" in normalized
        or f'relation "{table}" does not exist' in normalized
        or f"relation '{table}' does not exist" in normalized
    )


def _save_settings_row(
    *,
    user_id: str,
    garage_id: str,
    payload: dict[str, Any],
) -> bool:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para actualizar configuracion de usuario')

    try:
        admin_client.table('settings').upsert(payload, on_conflict='user_id,garage_id').execute()
        return True
    except Exception as exc:
        if _is_missing_table_error(exc, 'settings'):
            return False

        existing = _load_settings_row(user_id, garage_id)
        try:
            if existing.get('id'):
                admin_client.table('settings').update(payload).eq('id', existing['id']).execute()
            else:
                admin_client.table('settings').insert(payload).execute()
            return True
        except Exception as nested_exc:
            if _is_missing_table_error(nested_exc, 'settings'):
                return False
            raise


def ensure_user_role_and_garage(
    user_id: str | None,
    *,
    email: str | None = None,
    full_name: str | None = None,
    default_role: str = 'usuario',
) -> dict[str, Any]:
    if not user_id:
        raise RuntimeError('No se encontro el usuario autenticado.')

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para sincronizar usuarios.')

    user_obj = get_auth_user(user_id)
    current_metadata = _extract_user_metadata(user_obj)
    current_role = _extract_role(user_obj)
    current_garage_id = _extract_garage_id(user_obj)
    settings_row = _load_settings_row(user_id, current_garage_id)

    resolved_role = current_role or str(default_role or 'usuario').strip().lower()
    resolved_garage_id = current_garage_id or settings_row.get('garage_id') or str(uuid4())
    resolved_name = (full_name or _extract_display_name(user_obj, email) or '').strip()

    next_metadata = {
        **current_metadata,
        'role': resolved_role,
        'garage_id': resolved_garage_id,
        'full_name': resolved_name or current_metadata.get('full_name') or '',
    }

    admin_client.auth.admin.update_user_by_id(user_id, {'user_metadata': next_metadata})

    settings_payload = {
        'user_id': user_id,
        'garage_id': resolved_garage_id,
        'company_name': settings_row.get('company_name') or '',
        'address': settings_row.get('address') or '',
        'phone': settings_row.get('phone') or '',
        'avatar_url': settings_row.get('avatar_url') or '',
        'hourly_rate': settings_row.get('hourly_rate'),
    }
    _save_settings_row(user_id=user_id, garage_id=resolved_garage_id, payload=settings_payload)

    return {
        'user_id': user_id,
        'email': getattr(user_obj, 'email', None) or email,
        'role': resolved_role,
        'garage_id': resolved_garage_id,
        'full_name': resolved_name,
    }


def get_user_role(user_id: str | None) -> str | None:
    if not user_id:
        return None

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return None

    try:
        response = admin_client.auth.admin.get_user_by_id(user_id)
        user_obj = getattr(response, 'user', None)
        return _extract_role(user_obj)
    except Exception:
        return None


def get_user_garage_id(user_id: str | None) -> str | None:
    if not user_id:
        return None

    user_obj = get_auth_user(user_id)
    garage_id = _extract_garage_id(user_obj)
    if garage_id:
        return garage_id

    try:
        settings_row = _load_settings_row(user_id, None)
        value = settings_row.get('garage_id')
        return str(value) if value else None
    except Exception:
        return None


def get_auth_user(user_id: str | None) -> Any | None:
    if not user_id:
        return None

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return None

    try:
        response = admin_client.auth.admin.get_user_by_id(user_id)
        return getattr(response, 'user', None)
    except Exception:
        return None


def _load_settings_row(user_id: str | None, garage_id: str | None = None) -> dict[str, Any]:
    if not user_id:
        return {}

    client = get_supabase_admin_client() or get_supabase_client()
    try:
        query = client.table('settings').select('*').eq('user_id', user_id)
        if garage_id:
            query = query.eq('garage_id', garage_id)
        response = query.limit(1).execute()
        rows = response.data or []
        if not rows:
            return {}

        row = rows[0]
        if str(row.get('user_id') or '') != str(user_id):
            return {}
        if garage_id and str(row.get('garage_id') or '') != str(garage_id):
            return {}
        return row
    except Exception:
        return {}


def obtener_configuracion_usuario(
    user_id: str | None,
    email: str | None = None,
    garage_id: str | None = None,
) -> dict[str, Any]:
    user_obj = get_auth_user(user_id)
    resolved_garage_id = garage_id or _extract_garage_id(user_obj)
    settings_row = _load_settings_row(user_id, resolved_garage_id)
    resolved_garage_id = resolved_garage_id or settings_row.get('garage_id')

    return {
        'user_id': user_id,
        'garage_id': resolved_garage_id,
        'email': getattr(user_obj, 'email', None) or email,
        'name': _extract_display_name(user_obj, None) if user_obj else None,
        'full_name': _extract_display_name(user_obj, None) if user_obj else None,
        'phone': _extract_phone(user_obj) if user_obj else None,
        'avatar_url': (_extract_avatar_url(user_obj) if user_obj else None) or settings_row.get('avatar_url') or '',
        'role': _extract_role(user_obj) if user_obj else get_user_role(user_id),
        'two_factor_enabled': _extract_two_factor_enabled(user_obj) if user_obj else False,
        'company_name': settings_row.get('company_name') or settings_row.get('nombre_empresa') or '',
        'company_address': settings_row.get('address') or settings_row.get('direccion') or '',
        'company_phone': settings_row.get('phone') or settings_row.get('telefono') or '',
        'hourly_rate': settings_row.get('hourly_rate') or '',
    }


def list_auth_users() -> list[dict[str, Any]]:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para listar usuarios')

    users = admin_client.auth.admin.list_users()
    items: list[dict[str, Any]] = []
    for user_obj in users or []:
        items.append(
            {
                'id': getattr(user_obj, 'id', None),
                'email': getattr(user_obj, 'email', None),
                'name': _extract_display_name(user_obj, getattr(user_obj, 'email', None)),
                'role': _extract_role(user_obj),
                'created_at': getattr(user_obj, 'created_at', None),
                'last_sign_in_at': getattr(user_obj, 'last_sign_in_at', None),
            }
        )
    return items


def update_auth_user_role(user_id: str, role: str) -> dict[str, Any]:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para actualizar roles')

    current = admin_client.auth.admin.get_user_by_id(user_id)
    current_user = getattr(current, 'user', None)
    current_metadata = getattr(current_user, 'user_metadata', None) or {}
    if not isinstance(current_metadata, dict):
        current_metadata = {}

    response = admin_client.auth.admin.update_user_by_id(
        user_id,
        {'user_metadata': {**current_metadata, 'role': role}},
    )
    user_obj = getattr(response, 'user', None)
    return {
        'id': getattr(user_obj, 'id', user_id),
        'email': getattr(user_obj, 'email', None),
        'name': _extract_display_name(user_obj, getattr(user_obj, 'email', None)),
        'role': _extract_role(user_obj) or role,
    }


def _ensure_bucket(bucket_name: str) -> None:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        return

    try:
        buckets = admin_client.storage.list_buckets()
        if any(getattr(bucket, 'id', None) == bucket_name or getattr(bucket, 'name', None) == bucket_name for bucket in buckets):
            return
    except Exception:
        pass

    try:
        admin_client.storage.create_bucket(bucket_name, options={'public': True})
    except Exception:
        pass


def subir_foto_perfil(user_id: str, file_storage: Any) -> str:
    client = get_supabase_admin_client() or get_supabase_client()
    bucket_name = os.getenv('SUPABASE_AVATARS_BUCKET', 'user-photos')
    _ensure_bucket(bucket_name)

    filename = getattr(file_storage, 'filename', '') or 'avatar.png'
    extension = Path(filename).suffix or '.png'
    path = f'{user_id}/avatar-{int(datetime.now(timezone.utc).timestamp())}{extension}'
    content = file_storage.read()
    if not content:
        raise RuntimeError('La imagen seleccionada esta vacia.')

    file_options = {
        'content-type': getattr(file_storage, 'mimetype', None) or 'application/octet-stream',
        'upsert': 'true',
    }
    client.storage.from_(bucket_name).upload(path, content, file_options=file_options)
    return client.storage.from_(bucket_name).get_public_url(path)


def guardar_configuracion_usuario(
    *,
    user_id: str,
    garage_id: str | None,
    email: str | None,
    full_name: str | None,
    phone: str | None,
    avatar_url: str | None,
    company_name: str | None,
    company_address: str | None,
    company_phone: str | None,
    hourly_rate: float | None,
) -> dict[str, Any]:
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para actualizar configuracion de usuario')
    if not garage_id:
        raise RuntimeError('No se encontro el garage_id del usuario autenticado.')

    current_user = get_auth_user(user_id)
    current_metadata = _extract_user_metadata(current_user)
    current_settings = _load_settings_row(user_id, garage_id)
    next_metadata = {
        **current_metadata,
        'full_name': full_name or '',
        'phone': phone or '',
        'avatar_url': avatar_url or current_metadata.get('avatar_url') or '',
        'garage_id': garage_id,
    }
    admin_client.auth.admin.update_user_by_id(user_id, {'user_metadata': next_metadata})

    settings_payload = {
        'user_id': user_id,
        'garage_id': garage_id,
        'company_name': company_name or '',
        'address': company_address or '',
        'phone': company_phone or '',
        'avatar_url': avatar_url or '',
        'hourly_rate': hourly_rate if hourly_rate is not None else current_settings.get('hourly_rate'),
    }
    _save_settings_row(user_id=user_id, garage_id=garage_id, payload=settings_payload)

    return obtener_configuracion_usuario(user_id, email, garage_id)


def cambiar_password_usuario(access_token: str | None, refresh_token: str | None, new_password: str) -> None:
    if not access_token or not refresh_token:
        raise RuntimeError('No se encontro una sesion valida para actualizar la contrasena.')

    client = get_supabase_client()
    client.auth.set_session(access_token=access_token, refresh_token=refresh_token)
    client.auth.update_user({'password': new_password})


def eliminar_cuenta_usuario(user_id: str | None) -> None:
    if not user_id:
        raise RuntimeError('No se encontro el usuario autenticado.')

    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY es requerida para eliminar cuentas.')

    try:
        admin_client.table('settings').delete().eq('user_id', user_id).execute()
    except Exception as exc:
        if not _is_missing_table_error(exc, 'settings'):
            pass

    admin_client.auth.admin.delete_user(user_id)


def admin_exists() -> bool:
    return any((user.get('role') or '').strip().lower() == 'admin' for user in list_auth_users())


def test_supabase_connection() -> dict[str, Any]:
    client = get_supabase_client()
    response = client.table('vehicles').select('id').limit(1).execute()
    return {
        'ok': True,
        'tabla': 'vehicles',
        'registros_detectados': len(response.data or []),
    }


def registrar_evento_auth(email: str, evento: str) -> None:
    client = get_supabase_client()
    timestamp = datetime.now(timezone.utc).isoformat()
    payloads = [
        {'email': email, 'evento': evento, 'fecha': timestamp},
        {'email': email, 'fecha': timestamp},
        {'email': email, 'evento': evento},
        {'email': email},
    ]
    for payload in payloads:
        try:
            client.table('auth_logs').insert(payload).execute()
            return
        except Exception:
            continue


def registrar_login_session(
    user_id: str | None,
    email: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any] | None:
    client = get_supabase_client()
    payload = {
        'user_id': user_id,
        'email': email,
        'ip_address': ip_address,
        'user_agent': user_agent,
    }
    response = client.table('login_sessions').insert(payload).execute()
    data = response.data or []
    return data[0] if data else payload


def listar_login_sessions() -> list[dict[str, Any]]:
    client = get_supabase_client()
    response = (
        client.table('login_sessions')
        .select('*')
        .order('created_at', desc=True)
        .execute()
    )
    return response.data or []


def registrar_usuario_registrado(
    *,
    user_id: str | None,
    email: str,
    nombre: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    estado: str = 'pendiente',
) -> dict[str, Any] | None:
    client = get_supabase_client()
    payload = {
        'user_id': user_id,
        'email': email,
        'nombre': nombre or '',
        'ip_address': ip_address,
        'user_agent': user_agent,
        'estado': estado,
    }
    response = client.table('registros_usuarios').insert(payload).execute()
    data = response.data or []
    return data[0] if data else payload


def listar_registros_usuarios() -> list[dict[str, Any]]:
    client = get_supabase_client()
    response = (
        client.table('registros_usuarios')
        .select('*')
        .order('created_at', desc=True)
        .execute()
    )
    return response.data or []


def enviar_codigo_verificacion(email: str, codigo: str, full_name: str | None = None) -> None:
    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('SMTP_FROM_EMAIL') or smtp_user
    from_name = os.getenv('SMTP_FROM_NAME', 'SmarkPark')

    if not smtp_user or not smtp_password or not from_email:
        raise RuntimeError('SMTP_USER, SMTP_PASSWORD y SMTP_FROM_EMAIL son requeridos')

    display_name = (full_name or '').strip() or 'Usuario'
    saludo = f'Hola {display_name},'
    logo_cid = 'smartpark-logo'
    logo_path = Path(__file__).resolve().parents[2] / 'frontend' / 'public' / 'images' / 'logo-smartpark.png'
    logo_tag = (
        f'<img src="cid:{logo_cid}" alt="SmartPark" '
        'style="display:block;width:88px;height:88px;margin:0 auto 18px;border-radius:50%;object-fit:cover;" />'
    )
    if not logo_path.exists():
        logo_tag = (
            '<div style="width:88px;height:88px;margin:0 auto 18px;border-radius:50%;'
            'background:linear-gradient(135deg,#072B73,#ACD7F2);display:flex;align-items:center;'
            'justify-content:center;color:#ffffff;font-size:32px;font-weight:700;">S</div>'
        )

    plain_text = (
        f'{saludo}\n\n'
        'Te damos la bienvenida a SmartPark - Control Total.\n'
        'Usa el siguiente codigo de verificacion para completar tu acceso:\n\n'
        f'{codigo}\n\n'
        'Este codigo expira en 10 minutos.\n\n'
        'SmartPark - Control Total\n'
    )
    html_content = f"""
    <html>
      <body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;">
                <tr>
                  <td style="padding:0 0 18px;text-align:center;">
                    <p style="margin:0;color:#7dd3fc;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;">Verificacion de cuenta</p>
                  </td>
                </tr>
                <tr>
                  <td style="border-radius:30px;overflow:hidden;background:linear-gradient(180deg,#16233d 0%,#121c30 100%);border:1px solid rgba(172,215,242,0.14);box-shadow:0 28px 60px rgba(2,6,23,0.45);">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:42px 44px 34px;background:
                          radial-gradient(circle at top left, rgba(96,165,250,0.22), transparent 30%),
                          radial-gradient(circle at top right, rgba(125,211,252,0.16), transparent 28%),
                          linear-gradient(180deg,#172642 0%,#121d33 100%);
                          text-align:center;border-bottom:1px solid rgba(172,215,242,0.12);">
                          {logo_tag}
                          <h1 style="margin:0;color:#ffffff;font-size:36px;line-height:1.1;font-weight:800;letter-spacing:-0.02em;">SmartPark</h1>
                          <p style="margin:10px 0 0;color:#ACD7F2;font-size:16px;letter-spacing:0.18em;text-transform:uppercase;">Control Total</p>
                          <p style="margin:18px auto 0;max-width:420px;color:#cfe4f7;font-size:15px;line-height:1.7;">
                            Plataforma segura para la gestion de acceso y control inteligente de estacionamiento.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:38px 44px 18px;background:#121b2f;">
                          <p style="margin:0 0 12px;color:#7dd3fc;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;">Codigo OTP</p>
                          <p style="margin:0 0 14px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;">{saludo}</p>
                          <p style="margin:0;color:#d9e7f7;font-size:16px;line-height:1.8;">
                            Hemos recibido una solicitud para verificar tu cuenta. Usa el codigo siguiente para completar tu registro de forma segura.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 44px 18px;background:#121b2f;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;">
                            <tr>
                              <td style="border-radius:24px;background:linear-gradient(180deg,#0c1730 0%,#101f3d 100%);border:1px solid rgba(125,211,252,0.34);padding:10px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding:18px 18px 8px;text-align:center;">
                                      <p style="margin:0;color:#9bc9ea;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;">Tu codigo de verificacion</p>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:4px 18px 22px;text-align:center;">
                                      <div style="display:inline-block;min-width:270px;padding:18px 24px;border-radius:18px;background:#0f172a;border:1px solid rgba(172,215,242,0.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02);color:#ffffff;font-size:44px;font-weight:800;letter-spacing:0.34em;">
                                        {codigo}
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 44px 24px;background:#121b2f;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(15,23,42,0.55);border:1px solid rgba(172,215,242,0.1);border-radius:18px;">
                            <tr>
                              <td style="padding:18px 20px;">
                                <p style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:700;">Detalles importantes</p>
                                <p style="margin:0 0 8px;color:#c7d5e8;font-size:14px;line-height:1.7;">
                                  Este codigo expira en <strong style="color:#ffffff;">10 minutos</strong>.
                                </p>
                                <p style="margin:0;color:#8ea4bf;font-size:13px;line-height:1.7;">
                                  Por seguridad, no compartas este codigo con nadie. Si no solicitaste este correo, puedes ignorarlo.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:22px 44px 28px;background:#0d1526;border-top:1px solid rgba(172,215,242,0.12);text-align:center;">
                          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">SmartPark - Control Total</p>
                          <p style="margin:8px 0 0;color:#8ea4bf;font-size:13px;">Correo automatico de verificacion</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    msg = EmailMessage()
    msg['Subject'] = 'Codigo de verificacion - SmartPark'
    msg['From'] = f'{from_name} <{from_email}>'
    msg['To'] = email
    msg.set_content(plain_text)
    msg.add_alternative(html_content, subtype='html')

    if logo_path.exists():
        msg.get_payload()[-1].add_related(
            logo_path.read_bytes(),
            maintype='image',
            subtype='png',
            cid=f'<{logo_cid}>',
            filename=logo_path.name,
        )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(smtp_user, smtp_password)
        smtp.send_message(msg)


def _extract_user_info(auth_response: Any, fallback_email: str) -> dict[str, Any]:
    user_obj = getattr(auth_response, 'user', None)
    session_obj = getattr(auth_response, 'session', None)
    return {
        'user_id': getattr(user_obj, 'id', None),
        'email': getattr(user_obj, 'email', fallback_email),
        'garage_id': _extract_garage_id(user_obj),
        'access_token': getattr(session_obj, 'access_token', None),
        'refresh_token': getattr(session_obj, 'refresh_token', None),
    }


def activar_usuario_auth(email: str, password: str, full_name: str | None = None) -> dict[str, Any]:
    admin_client = get_supabase_admin_client()
    if admin_client is not None:
        attrs: dict[str, Any] = {'email': email, 'password': password, 'email_confirm': True}
        if full_name:
            attrs['user_metadata'] = {'full_name': full_name}
        try:
            created = admin_client.auth.admin.create_user(attrs)
            user_obj = getattr(created, 'user', None)
            return {'user_id': getattr(user_obj, 'id', None), 'email': getattr(user_obj, 'email', email)}
        except Exception as exc:
            message = str(exc)
            if 'already been registered' not in message.lower():
                raise

            listed = admin_client.auth.admin.list_users()
            candidates = getattr(listed, 'users', None) or listed or []
            for user_obj in candidates:
                existing_email = (getattr(user_obj, 'email', None) or '').strip().lower()
                if existing_email == email.strip().lower():
                    return {
                        'user_id': getattr(user_obj, 'id', None),
                        'email': getattr(user_obj, 'email', email),
                    }
            raise

    client = get_supabase_client()
    credentials: dict[str, Any] = {'email': email, 'password': password}
    if full_name:
        credentials['options'] = {'data': {'full_name': full_name}}
    created = client.auth.sign_up(credentials)
    return _extract_user_info(created, email)


def insertar_usuario_tabla(
    user_id: str | None,
    email: str,
    full_name: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    estado: str = 'pendiente',
) -> None:
    client = get_supabase_client()
    try:
        existing = (
            client.table('registros_usuarios')
            .select('id')
            .eq('email', email)
            .limit(1)
            .execute()
        )
        if existing.data:
            return
    except Exception:
        pass

    payload = {
        'user_id': user_id,
        'email': email,
        'nombre': full_name or '',
        'ip_address': ip_address,
        'user_agent': user_agent,
        'estado': estado,
    }

    cleaned = {k: v for k, v in payload.items() if v is not None}
    client.table('registros_usuarios').insert(cleaned).execute()


def login_usuario(email: str, password: str) -> dict[str, Any]:
    client = get_supabase_client()
    auth_response = client.auth.sign_in_with_password({'email': email, 'password': password})
    data = _extract_user_info(auth_response, email)
    try:
        registrar_evento_auth(email=email, evento='login_success')
    except Exception:
        pass
    return data


def cerrar_sesion(access_token: str | None = None, refresh_token: str | None = None) -> dict[str, Any]:
    client = get_supabase_client()
    if access_token and refresh_token:
        client.auth.set_session(access_token=access_token, refresh_token=refresh_token)
    client.auth.sign_out()
    return {'ok': True, 'mensaje': 'Sesion cerrada correctamente'}
