from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.supabase_client import get_supabase_client


ALLOWED_OTP_TYPES = {'login', 'registro', 'recuperacion'}


class OTPService:
    def __init__(self) -> None:
        self._client = None
        self.table_name = 'otp_codes'
        self.expiration_minutes = 10

    def _get_client(self):
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def _generate_code(self) -> str:
        return f'{secrets.randbelow(1_000_000):06d}'

    def generar_codigo(
        self,
        email: str,
        tipo: str,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        current_type = str(tipo or '').strip().lower()
        if current_type not in ALLOWED_OTP_TYPES:
            raise ValueError('Tipo OTP invalido. Usa login, registro o recuperacion.')

        code = self._generate_code()
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.expiration_minutes)

        payload = {
          'user_id': user_id,
          'email': email,
          'codigo': code,
          'tipo': current_type,
          'usado': False,
          'expira_at': expires_at.isoformat(),
        }

        response = self._get_client().table(self.table_name).insert(payload).execute()
        data = response.data or []
        return self._normalize_row(data[0]) if data else self._normalize_row(payload)

    def verificar_codigo(self, email: str, codigo: str, tipo: str) -> dict[str, Any]:
        current_type = str(tipo or '').strip().lower()
        if current_type not in ALLOWED_OTP_TYPES:
            raise ValueError('Tipo OTP invalido. Usa login, registro o recuperacion.')

        response = (
            self._get_client()
            .table(self.table_name)
            .select('*')
            .eq('email', email)
            .eq('codigo', codigo)
            .eq('tipo', current_type)
            .eq('usado', False)
            .order('created_at', desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise LookupError('Codigo OTP invalido o ya usado.')

        row = rows[0]
        expires_at = self._parse_datetime(row.get('expira_at'))
        now = datetime.now(timezone.utc)
        if expires_at is None or expires_at < now:
            raise TimeoutError('El codigo OTP ha expirado.')

        updated = (
            self._get_client()
            .table(self.table_name)
            .update({'usado': True})
            .eq('id', row.get('id'))
            .execute()
        )
        data = updated.data or [row]
        normalized = self._normalize_row(data[0])
        normalized['valido'] = True
        return normalized

    def listar_codigos(self) -> list[dict[str, Any]]:
        response = (
            self._get_client()
            .table(self.table_name)
            .select('*')
            .order('created_at', desc=True)
            .execute()
        )
        return [self._normalize_row(row) for row in (response.data or [])]

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        text = str(value).replace('Z', '+00:00')
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
        return {
            'id': row.get('id'),
            'user_id': row.get('user_id'),
            'email': row.get('email'),
            'codigo': row.get('codigo'),
            'tipo': row.get('tipo'),
            'usado': bool(row.get('usado')),
            'expira_at': row.get('expira_at'),
            'created_at': row.get('created_at'),
        }


otp_service = OTPService()
