"""Service layer for users CRUD operations."""

from typing import Any

from app.database.supabase_client import get_supabase_client


class UserService:
    """Encapsulates all access to the users table."""

    def __init__(self) -> None:
        self._client = None
        self.table_name = 'users'

    def _get_client(self):
        # Lazy init avoids boot-time failure when env vars are not loaded yet.
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def get_all_users(self) -> list[dict[str, Any]]:
        response = self._get_client().table(self.table_name).select('id,name,email').order('id').execute()
        return response.data or []

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        response = self._get_client().table(self.table_name).select('id,name,email').eq('id', user_id).execute()
        data = response.data or []
        return data[0] if data else None

    def create_user(self, name: str, email: str) -> dict[str, Any]:
        payload = {'name': name, 'email': email}
        response = self._get_client().table(self.table_name).insert(payload).execute()
        data = response.data or []
        return data[0] if data else payload

    def update_user(self, user_id: int, name: str, email: str) -> dict[str, Any] | None:
        payload = {'name': name, 'email': email}
        response = self._get_client().table(self.table_name).update(payload).eq('id', user_id).execute()
        data = response.data or []
        return data[0] if data else None

    def delete_user(self, user_id: int) -> bool:
        existing = self.get_user_by_id(user_id)
        if not existing:
            return False

        self._get_client().table(self.table_name).delete().eq('id', user_id).execute()
        return True


user_service = UserService()