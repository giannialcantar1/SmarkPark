from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.supabase_client import get_user_table_client, normalize_parking_space, normalize_text, update_rows, utcnow_iso


class ParkingSpaceRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("parking_spaces", normalizer=normalize_parking_space)

    def get_by_id_in_garage(self, record_id: str, garage_id: str) -> dict | None:
        return self.get_first(
            filters=[
                {"column": "id", "value": record_id, "optional": False},
                {"column": "garage_id", "value": garage_id, "optional": False},
            ]
        )

    def get_available(self, garage_id: str, *, floor: str | None = None) -> list[dict]:
        spaces = self.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["piso", "numero", "codigo", "code"],
        )
        available = [space for space in spaces if not space.get("occupied")]
        if floor:
            wanted_floor = normalize_text(floor)
            available = [space for space in available if normalize_text(space.get("floor")) == wanted_floor]
        return available

    def update_in_garage(self, record_id: str, garage_id: str, payload: dict) -> dict | None:
        rows = update_rows(
            self.table_name,
            payload={**payload, "updated_at": utcnow_iso()},
            filters=[
                {"column": "id", "value": record_id, "optional": False},
                {"column": "garage_id", "value": garage_id, "optional": False},
            ],
        )
        if rows:
            return self._normalize_one(rows[0])
        return self.get_by_id_in_garage(record_id, garage_id)

    def delete_in_garage(self, record_id: str, garage_id: str) -> bool:
        try:
            get_user_table_client(use_admin=True).table(self.table_name).delete().eq("id", record_id).eq("garage_id", garage_id).execute()
            return True
        except Exception:
            return False
