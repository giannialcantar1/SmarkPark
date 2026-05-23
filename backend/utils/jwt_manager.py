from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import jwt

from config import Config
from utils.supabase_client import get_user_table_client


class JWTManager:
    def __init__(self) -> None:
        self.secret_key = Config.JWT_SECRET_KEY
        self.algorithm = Config.JWT_ALGORITHM
        self.access_ttl_minutes = Config.JWT_ACCESS_TTL_MINUTES
        self.refresh_ttl_days = Config.JWT_REFRESH_TTL_DAYS

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def generate_token(self, payload: dict[str, Any], *, token_type: str = "access", expires_delta: timedelta | None = None) -> str:
        now = self._now()
        ttl = expires_delta
        if ttl is None:
            ttl = timedelta(minutes=self.access_ttl_minutes) if token_type == "access" else timedelta(days=self.refresh_ttl_days)

        claims = {
            **payload,
            "type": token_type,
            "iat": int(now.timestamp()),
            "exp": int((now + ttl).timestamp()),
        }
        return jwt.encode(claims, self.secret_key, algorithm=self.algorithm)

    def generate_access_token(self, payload: dict[str, Any]) -> str:
        return self.generate_token(payload, token_type="access")

    def generate_refresh_token(self, payload: dict[str, Any]) -> str:
        return self.generate_token(payload, token_type="refresh")

    def validate_local_token(self, token: str, *, expected_type: str | None = None) -> dict[str, Any]:
        claims = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        if expected_type and claims.get("type") != expected_type:
            raise ValueError(f"Se esperaba un token de tipo {expected_type}")
        return claims

    def _user_from_local_claims(self, claims: dict[str, Any]):
        metadata = {
            "garage_id": claims.get("garage_id") or claims.get("garaje_id") or "",
            "role": claims.get("role") or claims.get("rol") or "usuario",
            "name": claims.get("name") or claims.get("full_name") or claims.get("email") or "Usuario",
            "full_name": claims.get("full_name") or claims.get("name") or claims.get("email") or "Usuario",
        }
        return SimpleNamespace(
            id=claims.get("sub") or claims.get("user_id") or claims.get("id"),
            email=claims.get("email"),
            role=claims.get("role") or claims.get("rol") or "usuario",
            user_metadata=metadata,
        )

    @staticmethod
    def _looks_like_auth_backend_error(exc: Exception) -> bool:
        message = str(exc or "").lower()
        return any(
            token in message
            for token in (
                "timeout",
                "timed out",
                "connection",
                "connect",
                "ssl",
                "server disconnected",
                "temporarily unavailable",
                "name resolution",
                "dns",
                "configura supabase",
                "supabase_url",
                "supabase_key",
                "service role",
                "network",
            )
        )

    def verify_token(self, token: str):
        if not token:
            raise ValueError("JWT requerido")

        try:
            claims = self.validate_local_token(token, expected_type="access")
            return self._user_from_local_claims(claims)
        except jwt.ExpiredSignatureError:
            raise ValueError("Token invalido o expirado")
        except jwt.InvalidTokenError:
            pass

        try:
            client = get_user_table_client(use_admin=False)
            result = client.auth.get_user(token)
            user = getattr(result, "user", None)
            if not user:
                raise ValueError("Token invalido o expirado")
            return user
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            if self._looks_like_auth_backend_error(e):
                raise RuntimeError(f"No fue posible validar la sesion con Supabase: {e}")
            raise ValueError(f"Token invalido: {e}")

    def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        if not refresh_token:
            raise ValueError("Refresh token requerido")

        try:
            claims = self.validate_local_token(refresh_token, expected_type="refresh")
            payload = {key: value for key, value in claims.items() if key not in {"exp", "iat", "type"}}
            return {
                "token": self.generate_access_token(payload),
                "refresh_token": self.generate_refresh_token(payload),
                "token_type": "bearer",
                "expires_in": self.access_ttl_minutes * 60,
                "source": "local",
            }
        except jwt.InvalidTokenError:
            client = get_user_table_client(use_admin=False)
            session = client.auth.refresh_session(refresh_token)
            session_obj = getattr(session, "session", None) or session
            return {
                "token": getattr(session_obj, "access_token", None),
                "refresh_token": getattr(session_obj, "refresh_token", refresh_token),
                "token_type": getattr(session_obj, "token_type", "bearer"),
                "expires_in": getattr(session_obj, "expires_in", None),
                "source": "supabase",
            }


jwt_manager = JWTManager()
