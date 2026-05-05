from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.supabase_client import normalize_vehicle


class VehicleRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("vehicles", normalizer=normalize_vehicle)

    def get_by_garage(self, garage_id: str) -> list[dict]:
        return self.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["created_at", "placa", "plate"],
        )
