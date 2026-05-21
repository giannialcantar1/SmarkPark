from __future__ import annotations

from typing import Any

from repositories import UserRepository
from utils.supabase_client import ensure_auth_user_metadata, ensure_user_profile, normalize_text, select_rows, update_rows, utcnow_iso


class UserService:
    def __init__(self) -> None:
        self.user_repository = UserRepository()

    @staticmethod
    def _identity_keys(row: dict[str, Any] | None) -> set[str]:
        if not row:
            return set()
        return {
            key
            for key in {
                normalize_text((row or {}).get("id")),
                normalize_text((row or {}).get("auth_user_id")),
                normalize_text((row or {}).get("user_id")),
            }
            if key
        }

    @staticmethod
    def _identity_email(row: dict[str, Any] | None) -> str:
        return normalize_text((row or {}).get("email"))

    @staticmethod
    def _dedupe_key(row: dict[str, Any]) -> str:
        identity_keys = UserService._identity_keys(row)
        if identity_keys:
            return sorted(identity_keys)[0]
        return UserService._identity_email(row)

    def _garage_membership_reference(self, *, garage_id: str) -> tuple[set[str], set[str], list[dict[str, Any]]]:
        direct_rows = self.user_repository.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["created_at", "updated_at", "nombre", "email"],
            desc=True,
            limit=1000,
        )
        logs = select_rows(
            "registration_logs",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["created_at", "updated_at", "email"],
            desc=True,
            limit=1000,
        )

        garage_keys: set[str] = set()
        garage_emails: set[str] = set()
        for row in [*direct_rows, *logs]:
            garage_keys.update(self._identity_keys(row))
            email = self._identity_email(row)
            if email:
                garage_emails.add(email)

        return garage_keys, garage_emails, direct_rows

    def _belongs_to_garage(self, row: dict[str, Any], *, garage_id: str, garage_keys: set[str], garage_emails: set[str]) -> bool:
        if normalize_text(row.get("garage_id")) == normalize_text(garage_id):
            return True

        if self._identity_keys(row).intersection(garage_keys):
            return True

        email = self._identity_email(row)
        return bool(email and email in garage_emails)

    def create_user(self, user, *, garage_id: str | None = None, name: str | None = None, role: str | None = None) -> dict | None:
        profile = ensure_user_profile(user, garage_id=garage_id, name=name, role=role)
        if not profile:
            return None
        profile_id = profile.get("id")
        if profile_id:
            stored = self.user_repository.get_by_id(str(profile_id))
            if stored:
                return stored
        email = profile.get("email")
        if email:
            return self.user_repository.get_by_email(str(email)) or profile
        return profile

    def list_users(self, *, garage_id: str) -> list[dict]:
        garage_keys, garage_emails, direct_rows = self._garage_membership_reference(garage_id=garage_id)
        all_rows = self.user_repository.get_all(
            order_candidates=["created_at", "updated_at", "nombre", "email"],
            desc=True,
            limit=1000,
        )

        merged: list[dict[str, Any]] = []
        seen: set[str] = set()

        for row in [*direct_rows, *all_rows]:
            if not self._belongs_to_garage(row, garage_id=garage_id, garage_keys=garage_keys, garage_emails=garage_emails):
                continue

            dedupe_key = self._dedupe_key(row)
            if not dedupe_key or dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            merged.append(row)

        return merged

    def get_user(self, *, user_id: str | None = None, email: str | None = None) -> dict | None:
        if user_id:
            direct = self.user_repository.get_by_id(user_id)
            if direct:
                return direct
            auth_match = self.user_repository.get_first(
                filters=[{"column": "auth_user_id", "value": user_id, "optional": True}],
            )
            if auth_match:
                return auth_match
            legacy_match = self.user_repository.get_first(
                filters=[{"column": "user_id", "value": user_id, "optional": True}],
            )
            if legacy_match:
                return legacy_match
        if email:
            return self.user_repository.get_by_email(email)
        return None

    def update_user(self, *, user_id: str, payload: dict) -> dict | None:
        return self.user_repository.update(user_id, payload)

    def delete_user(self, *, user_id: str) -> bool:
        return self.user_repository.delete(user_id)

    @staticmethod
    def _is_staff_request(row: dict[str, Any]) -> bool:
        explicit_type = normalize_text(row.get("registration_type") or row.get("request_type"))
        if explicit_type == "staff":
            return True
        company_name = normalize_text(row.get("company_name") or row.get("empresa") or row.get("nombre_empresa"))
        return not company_name

    @staticmethod
    def _is_pending_status(value: Any) -> bool:
        return normalize_text(value) in {"pending", "pending_approval", "pendiente", "pendiente_aprobacion"}

    @staticmethod
    def _is_approved_status(value: Any) -> bool:
        return normalize_text(value) in {"approved", "aprobado", "active", "activo"}

    def get_access_status(self, *, user_id: str | None = None, email: str | None = None) -> str:
        profile = self.get_user(user_id=user_id, email=email)
        profile_status = normalize_text((profile or {}).get("approval_status") or (profile or {}).get("status"))
        if self._is_pending_status(profile_status):
            return "pendiente_aprobacion"
        if profile_status in {"rechazado", "rejected"}:
            return "rechazado"
        if self._is_approved_status(profile_status):
            return "aprobado"

        logs = select_rows(
            "registration_logs",
            filters=[{"column": "email", "value": email, "optional": True}],
            order_candidates=["created_at", "updated_at"],
            desc=True,
            limit=200,
        )
        normalized_user_id = normalize_text(user_id)
        for row in logs:
            if not self._is_staff_request(row):
                continue
            row_user_id = normalize_text(row.get("user_id") or row.get("auth_user_id"))
            row_email = normalize_text(row.get("email"))
            if normalized_user_id and row_user_id and row_user_id != normalized_user_id:
                continue
            if email and row_email and row_email != normalize_text(email):
                continue
            status = normalize_text(row.get("approval_status") or row.get("status"))
            if self._is_pending_status(status):
                return "pendiente_aprobacion"
            if status in {"rechazado", "rejected"}:
                return "rechazado"
            if self._is_approved_status(status):
                return "aprobado"
        return "aprobado"

    def list_pending_personnel(self, *, garage_id: str) -> list[dict[str, Any]]:
        rows = select_rows(
            "registration_logs",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["created_at", "updated_at"],
            desc=True,
            limit=500,
        )
        pending: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        for row in rows:
            if not self._is_staff_request(row):
                continue
            if not self._is_pending_status(row.get("approval_status") or row.get("status")):
                continue
            key = normalize_text(row.get("user_id") or row.get("auth_user_id") or row.get("email") or row.get("id"))
            if key in seen_keys:
                continue
            seen_keys.add(key)
            pending.append(
                {
                    "id": row.get("id"),
                    "user_id": row.get("user_id") or row.get("auth_user_id"),
                    "email": row.get("email"),
                    "name": row.get("name") or row.get("nombre") or row.get("full_name") or row.get("email") or "Usuario",
                    "role": normalize_text(row.get("role") or row.get("rol")) or "operador",
                    "status": "pendiente_aprobacion",
                    "garage_id": row.get("garage_id"),
                    "created_at": row.get("created_at"),
                    "approved_at": row.get("approved_at"),
                }
            )
        return pending

    def approve_personnel_request(self, *, garage_id: str, request_id: str) -> dict[str, Any] | None:
        rows = select_rows(
            "registration_logs",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["created_at", "updated_at"],
            desc=True,
            limit=500,
        )
        target = next(
            (
                row
                for row in rows
                if self._is_staff_request(row)
                and normalize_text(row.get("id")) == normalize_text(request_id)
            ),
            None,
        )
        if not target:
            return None

        approved_at = utcnow_iso()
        updated_logs = update_rows(
            "registration_logs",
            payload={
                "status": "approved",
                "approval_status": "approved",
                "verification_status": "approved",
                "approved_at": approved_at,
                "updated_at": approved_at,
            },
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )

        user_filters = [
            {"column": "auth_user_id", "value": target.get("user_id") or target.get("auth_user_id"), "optional": True},
            {"column": "user_id", "value": target.get("user_id") or target.get("auth_user_id"), "optional": True},
            {"column": "email", "value": target.get("email"), "optional": True},
        ]
        for item in user_filters:
            if not item.get("value"):
                continue
            update_rows(
                "users",
                payload={
                    "status": "approved",
                    "approval_status": "approved",
                    "estado": "aprobado",
                    "updated_at": approved_at,
                },
                filters=[item],
            )

        auth_user_id = str(target.get("user_id") or target.get("auth_user_id") or "")
        if auth_user_id:
            ensure_auth_user_metadata(
                user_id=auth_user_id,
                email=target.get("email"),
                name=target.get("name") or target.get("nombre"),
                garage_id=garage_id,
                role=target.get("role") or target.get("rol") or "operador",
            )

        updated_row = updated_logs[0] if updated_logs else {**target, "status": "approved", "approved_at": approved_at}
        return {
            "id": updated_row.get("id") or target.get("id"),
            "user_id": target.get("user_id") or target.get("auth_user_id"),
            "email": target.get("email"),
            "name": target.get("name") or target.get("nombre") or target.get("email") or "Usuario",
            "role": normalize_text(target.get("role") or target.get("rol")) or "operador",
            "status": "approved",
            "garage_id": garage_id,
            "approved_at": approved_at,
        }
