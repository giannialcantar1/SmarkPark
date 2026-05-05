from __future__ import annotations

from typing import Any

from config import Config
from utils.supabase_client import get_supabase_admin_client, get_supabase_auth_client


class Database:
    def __init__(self) -> None:
        self.url = Config.SUPABASE_URL

    @property
    def auth_client(self):
        return get_supabase_auth_client()

    @property
    def admin_client(self):
        return get_supabase_admin_client()

    def client(self, *, use_admin: bool = False):
        if use_admin and self.admin_client is not None:
            return self.admin_client
        return self.auth_client

    def table(self, table_name: str, *, use_admin: bool = False):
        return self.client(use_admin=use_admin).table(table_name)

    def health(self) -> dict[str, Any]:
        try:
            self.auth_client.table("users").select("id").limit(1).execute()
            return {
                "success": True,
                "provider": "supabase",
                "url": self.url,
                "admin_available": self.admin_client is not None,
            }
        except Exception as exc:
            return {
                "success": False,
                "provider": "supabase",
                "url": self.url,
                "admin_available": self.admin_client is not None,
                "error": str(exc),
            }


db = Database()
