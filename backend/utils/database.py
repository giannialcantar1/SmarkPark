from __future__ import annotations

from typing import Any

from config import Config
from utils.supabase_client import get_supabase_admin_client, get_supabase_auth_client, get_user_table_client


class Database:
    def __init__(self) -> None:
        self.url = Config.SUPABASE_URL

    def is_configured(self) -> bool:
        return bool(Config.SUPABASE_URL and Config.SUPABASE_KEY)

    def get_client(self, *, use_admin: bool = False, allow_fallback: bool = True):
        return get_user_table_client(use_admin=use_admin, allow_fallback=allow_fallback)

    def auth_client(self):
        return get_supabase_auth_client()

    def admin_client(self):
        return get_supabase_admin_client()

    def table(self, table_name: str, *, use_admin: bool = True):
        return self.get_client(use_admin=use_admin).table(table_name)

    def health(self) -> dict[str, Any]:
        return {
            "configured": self.is_configured(),
            "url": self.url,
            "has_service_role": bool(Config.SUPABASE_SERVICE_ROLE_KEY),
        }


database = Database()
