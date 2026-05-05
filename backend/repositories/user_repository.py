from __future__ import annotations

from typing import Any

from repositories.base_repository import BaseRepository


def normalize_user(row: dict[str, Any]) -> dict[str, Any]:
    name = str(row.get("nombre") or row.get("name") or row.get("full_name") or "").strip()
    raw_role = row.get("rol") or row.get("role")
    role = str(raw_role).strip().lower() if raw_role not in (None, "") else None
    return {
        **row,
        "id": row.get("id") or row.get("auth_user_id") or row.get("user_id"),
        "email": str(row.get("email") or "").strip().lower(),
        "nombre": name,
        "name": name,
        "rol": role,
        "role": role,
        "garage_id": row.get("garage_id") or row.get("garaje_id"),
        "auth_user_id": row.get("auth_user_id") or row.get("user_id"),
        "user_id": row.get("user_id") or row.get("auth_user_id"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


class UserRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("users", normalizer=normalize_user)

    def get_by_email(self, email: str) -> dict[str, Any] | None:
        return self.get_first(
            filters=[{"column": "email", "value": str(email or "").strip().lower(), "optional": False}],
        )
