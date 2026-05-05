from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.supabase_client import normalize_session


class SessionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("parking_sessions", normalizer=normalize_session)

    def get_active_sessions(self) -> list[dict]:
        sessions = self.get_all(
            order_candidates=["entrada", "created_at"],
            desc=True,
        )
        return [session for session in sessions if session.get("is_active")]
