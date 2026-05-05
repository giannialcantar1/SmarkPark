from __future__ import annotations

import re

from flask import Request
from uuid import uuid4

from repositories import UserRepository
from services.alert_service import AlertService
from services.user_service import UserService
from utils.jwt_utils import refresh_jwt_token, verify_jwt_token
from utils.supabase_client import (
    ensure_auth_user_metadata,
    get_client_ip,
    get_user_display_name,
    get_user_email,
    get_user_garage_id,
    get_user_role,
    get_user_table_client,
    insert_row,
    select_rows,
    utcnow_iso,
)


class AuthService:
    def __init__(self) -> None:
        self.alert_service = AlertService()
        self.user_service = UserService()
        self.user_repository = UserRepository()

    def login(self, *, email: str, password: str, request: Request) -> dict:
        auth_client = get_user_table_client(use_admin=False)
        result = auth_client.auth.sign_in_with_password({"email": email, "password": password})
        session = getattr(result, "session", None)
        user = getattr(result, "user", None)
        if not session or not user:
            raise RuntimeError("Supabase no retorno una sesion valida")

        stored_user = self.user_repository.get_by_email(email)
        garage_id = (stored_user or {}).get("garage_id") or get_user_garage_id(user)
        name = (stored_user or {}).get("nombre") or get_user_display_name(user)
        role = (stored_user or {}).get("rol") or get_user_role(user)
        company_settings = self._get_company_settings(garage_id)
        user_metadata = dict(getattr(user, "user_metadata", None) or {})
        user_metadata["garage_id"] = garage_id
        user_metadata["role"] = role
        user_metadata["name"] = name
        if company_settings.get("company_name"):
            user_metadata["company_name"] = company_settings.get("company_name")
        setattr(user, "user_metadata", user_metadata)
        try:
            auth_client = get_user_table_client(use_admin=True)
            auth_client.auth.admin.update_user_by_id(
                str(getattr(user, "id", "")),
                {
                    "user_metadata": {
                        "garage_id": garage_id,
                        "role": role,
                        "name": name,
                        "company_name": company_settings.get("company_name", ""),
                    }
                },
            )
        except Exception as e:
            print(f"Error updating user metadata: {e}")

        ensure_auth_user_metadata(
            user_id=str(getattr(user, "id", "") or ""),
            email=email,
            name=name,
            garage_id=garage_id,
            role=role,
        )
        profile = self.user_service.create_user(user, garage_id=garage_id)
        stored_user = profile or stored_user or self.user_repository.get_by_email(email)
        self.alert_service.log_access_attempt(
            event="login",
            success=True,
            request=request,
            user_id=getattr(user, "id", None),
            email=email,
            garage_id=garage_id,
        )
        try:
            admin_client = get_user_table_client(use_admin=True)
            admin_client.from_('login_sessions').insert({
                'user_id': str(getattr(user, 'id', '')),
                'email': email,
                'ip_address': get_client_ip(request),
                'user_agent': request.headers.get('User-Agent', ''),
            }).execute()
        except Exception as e:
            print(f'[LOGIN_SESSIONS ERROR] {e}')

        return {
            "token": session.access_token,
            "refresh_token": getattr(session, "refresh_token", None),
            "token_type": getattr(session, "token_type", "bearer"),
            "expires_in": getattr(session, "expires_in", None),
            "user": {
                "id": getattr(user, "id", None),
                "email": get_user_email(user),
                "name": name,
                "role": role,
                "garage_id": garage_id,
                "company_name": company_settings.get("company_name", ""),
                "company_address": company_settings.get("company_address", ""),
                "company_phone": company_settings.get("company_phone", ""),
            },
        }

    def _get_company_settings(self, garage_id: str | None) -> dict:
        if not garage_id:
            return {}
        rows = select_rows(
            "settings",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["updated_at", "created_at"],
            desc=True,
            limit=1,
        )
        row = rows[0] if rows else {}
        return {
            "company_name": row.get("company_name") or row.get("nombre_empresa") or row.get("empresa") or "",
            "company_address": row.get("address") or row.get("company_address") or row.get("direccion") or "",
            "company_phone": row.get("company_phone") or row.get("phone") or row.get("telefono_empresa") or "",
        }

    def _make_garage_code(self, *, company_name: str, garage_id: str) -> str:
        prefix = re.sub(r"[^A-Z0-9]", "", company_name.upper())[:4] or "SPRK"
        suffix = re.sub(r"[^A-Fa-f0-9]", "", garage_id)[:8].upper()
        return f"{prefix}-{suffix}"

    def _create_company_record(
        self,
        *,
        garage_id: str,
        owner_user_id: str | None,
        company_name: str,
        company_address: str,
        company_phone: str,
        parking_spaces_count: int,
    ) -> dict:
        now = utcnow_iso()
        garage_code = self._make_garage_code(company_name=company_name, garage_id=garage_id)
        company_payload = {
            "garage_id": garage_id,
            "tenant_id": garage_id,
            "codigo": garage_code,
            "code": garage_code,
            "nombre": company_name,
            "name": company_name,
            "company_name": company_name,
            "direccion": company_address,
            "address": company_address,
            "telefono": company_phone,
            "phone": company_phone,
            "cupos_totales": parking_spaces_count,
            "total_spaces": parking_spaces_count,
            "owner_user_id": owner_user_id,
            "created_at": now,
            "updated_at": now,
        }
        company = insert_row("garajes", company_payload)
        insert_row(
            "settings",
            {
                "user_id": owner_user_id,
                "garage_id": garage_id,
                "company_name": company_name,
                "address": company_address,
                "phone": company_phone,
                "hourly_rate": 50,
                "created_at": now,
                "updated_at": now,
            },
        )
        self._seed_parking_spaces(garage_id=garage_id, count=parking_spaces_count)
        return company

    def _seed_parking_spaces(self, *, garage_id: str, count: int) -> None:
        existing = select_rows(
            "parking_spaces",
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            limit=1,
        )
        if existing:
            return

        rows = []
        for index in range(max(1, count)):
            floor_index = index // 20
            floor = chr(ord("A") + min(floor_index, 25))
            number = f"{floor}{(index % 20) + 1}"
            rows.append(
                {
                    "numero": number,
                    "piso": floor,
                    "ocupado": False,
                    "tipo_espacio": "regular",
                    "garage_id": garage_id,
                    "created_at": utcnow_iso(),
                }
            )

        for row in rows:
            try:
                insert_row("parking_spaces", row)
            except Exception as exc:
                print(f"[PARKING_SPACES SEED ERROR] {exc}")
                break

    def register(
        self,
        *,
        email: str,
        password: str,
        name: str,
        role: str,
        garage_id: str | None,
        company_name: str,
        company_address: str,
        company_phone: str,
        parking_spaces_count: int,
        request: Request,
    ) -> dict:
        resolved_garage_id = garage_id or str(uuid4())
        resolved_role = role or "admin"
        auth_client = get_user_table_client(use_admin=False)
        try:
            admin_client = get_user_table_client(use_admin=True, allow_fallback=False)
            result = admin_client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "name": name,
                        "full_name": name,
                        "garage_id": resolved_garage_id,
                        "role": resolved_role,
                        "company_name": company_name,
                    },
                }
            )
            user = getattr(result, "user", None)
        except Exception:
            result = auth_client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "data": {
                            "name": name,
                            "full_name": name,
                            "garage_id": resolved_garage_id,
                            "role": resolved_role,
                            "company_name": company_name,
                        }
                    },
                }
            )
            user = getattr(result, "user", None)

        if not user:
            raise RuntimeError("No fue posible crear el usuario")

        resolved_garage_id = get_user_garage_id(user, fallback=resolved_garage_id)
        ensure_auth_user_metadata(
            user_id=str(getattr(user, "id", "") or ""),
            email=email,
            name=name,
            garage_id=resolved_garage_id,
            role=resolved_role,
        )
        profile = self.user_service.create_user(user, garage_id=resolved_garage_id, name=name, role=resolved_role)
        company = self._create_company_record(
            garage_id=resolved_garage_id,
            owner_user_id=str(getattr(user, "id", "") or ""),
            company_name=company_name,
            company_address=company_address,
            company_phone=company_phone,
            parking_spaces_count=parking_spaces_count,
        )
        self.alert_service.log_access_attempt(
            event="register",
            success=True,
            request=request,
            user_id=getattr(user, "id", None),
            email=email,
            garage_id=resolved_garage_id,
        )

        # Guardar en registration_logs
        try:
            admin_client = get_user_table_client(use_admin=True)
            admin_client.from_('registration_logs').insert({
                'email': email,
                'name': name,
                'role': resolved_role,
                'garage_id': resolved_garage_id,
                'company_name': company_name,
                'ip_address': get_client_ip(request),
                'status': 'pending',
                'verification_status': 'pending',
            }).execute()
        except Exception as e:
            print(f'[REGISTRATION_LOGS ERROR] {e}')

        # Generar y enviar OTP
        try:
            from services.otp_service import OTPService
            otp_service = OTPService()
            otp_service.generate_and_send(
                user_id=str(getattr(user, 'id', '')),
                email=email,
            )
        except Exception as e:
            print(f'[OTP ERROR] {e}')

        stored_user = profile or self.user_repository.get_by_email(email)
        return {
            "user": {
                "id": getattr(user, "id", None),
                "email": email,
                "name": (stored_user or {}).get("nombre") or name,
                "role": (stored_user or {}).get("rol") or resolved_role,
                "garage_id": (stored_user or {}).get("garage_id") or resolved_garage_id,
                "company_name": company_name,
                "company_address": company_address,
                "company_phone": company_phone,
            },
            "company": company,
        }

    def verify_token(self, token: str):
        return verify_jwt_token(token)

    def refresh_token(self, *, refresh_token: str) -> dict:
        return refresh_jwt_token(refresh_token)
