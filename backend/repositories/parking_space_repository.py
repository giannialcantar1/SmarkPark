from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.supabase_client import normalize_parking_space, normalize_text


class ParkingSpaceRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("parking_spaces", normalizer=normalize_parking_space)

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
