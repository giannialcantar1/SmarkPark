from __future__ import annotations

import re
import traceback

from flask import Request
from uuid import uuid4

from repositories import UserRepository
from services.alert_service import AlertService
from services.user_service import UserService
from utils.jwt_utils import refresh_jwt_token, verify_jwt_token
from utils.supabase_client import (
    ensure_auth_user_metadata,
    get_client_ip,
    get_supabase_admin_client,
    get_user_display_name,
    get_user_email,
    get_user_garage_id,
    get_user_role,
    get_user_table_client,
    insert_row,
    normalize_text,
    select_rows,
    utcnow_iso,
)


class StaffRegistrationError(ValueError):
    def __init__(self, message: str, *, code: str = "staff_registration_error", debug_context: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.debug_context = debug_context or {}


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
        access_status = self.user_service.get_access_status(
            user_id=str(getattr(user, "id", "") or "") or None,
            email=email,
        )
        if access_status == "pendiente_aprobacion":
            admin_client = get_supabase_admin_client()
            if admin_client is not None:
                try:
                    admin_client.auth.admin.sign_out(str(getattr(user, "id", "") or ""), scope="global")
                except Exception:
                    pass
            raise PermissionError("Tu cuenta de personal esta pendiente de aprobacion por un administrador.")
        if access_status == "rechazado":
            raise PermissionError("Tu cuenta de personal fue rechazada. Contacta al administrador.")
        company_settings = self._get_company_settings(garage_id)
        user_metadata = dict(getattr(user, "user_metadata", None) or {})
        user_metadata["garage_id"] = garage_id
        user_metadata["role"] = role
        user_metadata["name"] = name
        user_metadata["approval_status"] = access_status
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
                "status": access_status,
                "approval_status": access_status,
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

    def _space_floor_label(self, index: int) -> str:
        floor_label = ""
        current = max(0, int(index))
        while True:
            current, remainder = divmod(current, 26)
            floor_label = chr(ord("A") + remainder) + floor_label
            if current == 0:
                return floor_label
            current -= 1

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
        company = insert_row("garages", company_payload)
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
        existing_spaces = select_rows(
            "parking_spaces",
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
        )
        if count <= 0:
            return
        existing_count = len(existing_spaces)
        if existing_count >= count:
            return

        rows = []
        for index in range(existing_count, count):
            floor_index = index // 20
            floor = self._space_floor_label(floor_index)
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

    def _resolve_garage_by_code(self, garage_code: str) -> dict:
        normalized_code = normalize_text(garage_code)
        if not normalized_code:
            raise StaffRegistrationError(
                "El codigo de invitacion del garaje es requerido.",
                code="missing_garage_code",
            )

        garages = select_rows(
            "garages",
            order_candidates=["created_at", "updated_at"],
            desc=True,
            limit=500,
        )
        for row in garages:
            candidates = {
                normalize_text(row.get("codigo")),
                normalize_text(row.get("code")),
                normalize_text(row.get("garage_code")),
                normalize_text(row.get("garage_id")),
                normalize_text(row.get("tenant_id")),
                normalize_text(row.get("id")),
            }
            if normalized_code in candidates:
                return row
        raise StaffRegistrationError(
            "No se encontro un garaje con ese codigo de invitacion. Verifica el garage_id compartido por el administrador.",
            code="garage_not_found",
            debug_context={
                "garage_code": garage_code,
                "normalized_garage_code": normalized_code,
                "garages_checked": len(garages),
            },
        )

    def _find_auth_user_by_email(self, email: str) -> dict | None:
        normalized_email = normalize_text(email)
        if not normalized_email:
            return None

        admin_client = get_supabase_admin_client()
        if admin_client is None:
            return None

        try:
            users = admin_client.auth.admin.list_users()
        except Exception as exc:
            print(f"[STAFF REGISTER] No se pudo listar usuarios auth para validar duplicados: {exc}")
            return None

        for user_obj in users or []:
            current_email = normalize_text(getattr(user_obj, "email", None))
            if current_email == normalized_email:
                metadata = getattr(user_obj, "user_metadata", None) or {}
                return {
                    "id": getattr(user_obj, "id", None),
                    "email": getattr(user_obj, "email", None),
                    "role": metadata.get("role") or getattr(user_obj, "role", None),
                    "approval_status": metadata.get("approval_status") or metadata.get("status"),
                }
        return None

    def _raise_if_staff_email_unavailable(self, *, email: str) -> None:
        existing_profile = self.user_repository.get_by_email(email)
        existing_auth_user = self._find_auth_user_by_email(email)

        if existing_auth_user:
            raise StaffRegistrationError(
                "Ya existe una cuenta registrada con ese email. Inicia sesion o usa otro correo.",
                code="email_already_exists",
                debug_context={
                    "email": email,
                    "auth_user_id": existing_auth_user.get("id"),
                    "auth_role": existing_auth_user.get("role"),
                    "auth_approval_status": existing_auth_user.get("approval_status"),
                },
            )

        if existing_profile:
            raise StaffRegistrationError(
                "Ese email ya esta asociado a un usuario existente. Usa otro correo o revisa la cuenta actual.",
                code="email_exists_in_users_table",
                debug_context={
                    "email": email,
                    "profile_id": existing_profile.get("id"),
                    "profile_role": existing_profile.get("role"),
                    "profile_status": existing_profile.get("status"),
                    "profile_garage_id": existing_profile.get("garage_id"),
                },
            )

    @staticmethod
    def _map_staff_registration_exception(exc: Exception) -> StaffRegistrationError:
        raw_message = str(exc or "").strip()
        lowered = raw_message.lower()

        if any(token in lowered for token in ("already registered", "already been registered", "user already registered", "duplicate key")):
            return StaffRegistrationError(
                "Ya existe una cuenta registrada con ese email. Inicia sesion o usa otro correo.",
                code="email_already_exists",
                debug_context={"raw_error": raw_message},
            )

        if "invalid email" in lowered:
            return StaffRegistrationError(
                "El email indicado no es valido.",
                code="invalid_email",
                debug_context={"raw_error": raw_message},
            )

        if "password" in lowered and any(token in lowered for token in ("weak", "short", "6")):
            return StaffRegistrationError(
                "La contrasena no cumple con los requisitos minimos.",
                code="weak_password",
                debug_context={"raw_error": raw_message},
            )

        return StaffRegistrationError(
            "No fue posible crear la solicitud de personal en Supabase.",
            code="supabase_staff_create_failed",
            debug_context={"raw_error": raw_message},
        )

    def register(
        self,
        *,
        email: str,
        password: str,
        name: str,
        role: str,
        garage_id: str | None = None,
        company_name: str = "",
        company_address: str = "",
        company_phone: str = "",
        parking_spaces_count: int = 20,
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
        company = None
        if company_name:
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

    def register_staff(
        self,
        *,
        email: str,
        password: str,
        name: str,
        role: str,
        garage_code: str,
        request: Request,
    ) -> dict:
        normalized_email = str(email or "").strip().lower()
        resolved_role = role or "operador"

        print(
            "[STAFF REGISTER] Starting",
            {
                "email": normalized_email,
                "role": resolved_role,
                "garage_code": garage_code,
                "ip_address": get_client_ip(request),
            },
        )

        if not normalized_email or not password or not name or not garage_code:
            missing_fields = [
                field_name
                for field_name, value in {
                    "email": normalized_email,
                    "password": password,
                    "name": name,
                    "garage_code": garage_code,
                }.items()
                if not str(value or "").strip()
            ]
            raise StaffRegistrationError(
                f"Faltan campos requeridos: {', '.join(missing_fields)}.",
                code="missing_required_fields",
                debug_context={"missing_fields": missing_fields},
            )

        garage = self._resolve_garage_by_code(garage_code)
        resolved_garage_id = str(garage.get("garage_id") or garage.get("tenant_id") or garage.get("id") or "")
        if not resolved_garage_id:
            raise StaffRegistrationError(
                "Se encontro el garaje, pero no fue posible determinar su garage_id.",
                code="garage_id_missing",
                debug_context={"garage_row": garage},
            )

        auth_client = get_user_table_client(use_admin=False)
        self._raise_if_staff_email_unavailable(email=normalized_email)

        try:
            admin_client = get_user_table_client(use_admin=True, allow_fallback=False)
            result = admin_client.auth.admin.create_user(
                {
                    "email": normalized_email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "name": name,
                        "full_name": name,
                        "garage_id": resolved_garage_id,
                        "role": resolved_role,
                        "approval_status": "pendiente_aprobacion",
                    },
                }
            )
            user = getattr(result, "user", None)
        except Exception as admin_exc:
            print(
                "[STAFF REGISTER] admin.create_user failed, attempting sign_up fallback",
                {
                    "email": normalized_email,
                    "garage_id": resolved_garage_id,
                    "role": resolved_role,
                    "error": str(admin_exc),
                    "type": type(admin_exc).__name__,
                },
            )
            try:
                result = auth_client.auth.sign_up(
                    {
                        "email": normalized_email,
                        "password": password,
                        "options": {
                            "data": {
                                "name": name,
                                "full_name": name,
                                "garage_id": resolved_garage_id,
                                "role": resolved_role,
                                "approval_status": "pendiente_aprobacion",
                            }
                        },
                    }
                )
                user = getattr(result, "user", None)
            except Exception as fallback_exc:
                mapped = self._map_staff_registration_exception(fallback_exc)
                print(
                    "[STAFF REGISTER] sign_up fallback failed",
                    {
                        "email": normalized_email,
                        "garage_id": resolved_garage_id,
                        "role": resolved_role,
                        "admin_error": str(admin_exc),
                        "fallback_error": str(fallback_exc),
                        "mapped_code": mapped.code,
                        "mapped_message": str(mapped),
                    },
                )
                traceback.print_exc()
                raise mapped from fallback_exc

        if not user:
            raise StaffRegistrationError(
                "Supabase no devolvio el usuario creado para la solicitud de personal.",
                code="staff_user_not_returned",
                debug_context={
                    "email": normalized_email,
                    "garage_id": resolved_garage_id,
                    "role": resolved_role,
                },
            )

        auth_user_id = str(getattr(user, "id", "") or "")
        ensure_auth_user_metadata(
            user_id=auth_user_id,
            email=normalized_email,
            name=name,
            garage_id=resolved_garage_id,
            role=resolved_role,
        )
        profile = self.user_service.create_user(user, garage_id=resolved_garage_id, name=name, role=resolved_role)
        if profile and profile.get("id"):
            try:
                self.user_service.update_user(
                    user_id=str(profile.get("id")),
                    payload={
                        "status": "pendiente_aprobacion",
                        "approval_status": "pendiente_aprobacion",
                        "estado": "pendiente_aprobacion",
                    },
                )
            except Exception:
                pass

        try:
            insert_row(
                "registration_logs",
                {
                    "user_id": auth_user_id,
                    "auth_user_id": auth_user_id,
                    "email": normalized_email,
                    "name": name,
                    "role": resolved_role,
                    "garage_id": resolved_garage_id,
                    "company_name": "",
                    "status": "pendiente_aprobacion",
                    "approval_status": "pendiente_aprobacion",
                    "verification_status": "approved",
                    "registration_type": "staff",
                    "ip_address": get_client_ip(request),
                },
            )
        except Exception as exc:
            print(f"[STAFF REGISTRATION LOG ERROR] {exc}")

        self.alert_service.log_access_attempt(
            event="staff_register",
            success=True,
            request=request,
            user_id=auth_user_id,
            email=normalized_email,
            garage_id=resolved_garage_id,
        )

        stored_user = profile or self.user_repository.get_by_email(normalized_email)
        print(
            "[STAFF REGISTER] Completed successfully",
            {
                "email": normalized_email,
                "auth_user_id": auth_user_id,
                "garage_id": resolved_garage_id,
                "role": resolved_role,
            },
        )
        return {
            "user": {
                "id": auth_user_id,
                "email": normalized_email,
                "name": (stored_user or {}).get("nombre") or name,
                "role": (stored_user or {}).get("rol") or resolved_role,
                "status": "pendiente_aprobacion",
                "approval_status": "pendiente_aprobacion",
                "garage_id": resolved_garage_id,
                "garage_code": garage.get("codigo") or garage.get("code") or garage_code,
            }
        }

    def verify_token(self, token: str):
        return verify_jwt_token(token)

    def refresh_token(self, *, refresh_token: str) -> dict:
        return refresh_jwt_token(refresh_token)
