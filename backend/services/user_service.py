from __future__ import annotations

from repositories import UserRepository
from utils.supabase_client import ensure_user_profile


class UserService:
    def __init__(self) -> None:
        self.user_repository = UserRepository()

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
        return self.user_repository.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["created_at", "updated_at", "nombre", "email"],
            desc=True,
        )

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
