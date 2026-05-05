from __future__ import annotations

from repositories import VehicleRepository
from utils.supabase_client import normalize_text


class VehicleService:
    def __init__(self) -> None:
        self.vehicle_repository = VehicleRepository()

    def list_vehicles(self, *, garage_id: str, propietario_id: str | None = None) -> list[dict]:
        normalized = self.vehicle_repository.get_by_garage(garage_id)
        if not propietario_id:
            return normalized
        wanted = normalize_text(propietario_id)
        return [
            row
            for row in normalized
            if normalize_text(row.get("propietario_id")) == wanted or normalize_text(row.get("user_id")) == wanted
        ]

    def get_vehicle(self, *, vehicle_id: str | None = None, garage_id: str | None = None, plate: str | None = None) -> dict | None:
        if vehicle_id:
            vehicle = self.vehicle_repository.get_by_id(vehicle_id)
            if vehicle and (not garage_id or normalize_text(vehicle.get("garage_id")) == normalize_text(garage_id)):
                return vehicle
        if garage_id and plate:
            wanted_plate = normalize_text(plate)
            return next(
                (
                    row
                    for row in self.vehicle_repository.get_by_garage(garage_id)
                    if normalize_text(row.get("plate")) == wanted_plate
                ),
                None,
            )
        return None

    def register_vehicle(
        self,
        *,
        garage_id: str,
        propietario_id: str,
        placa: str,
        marca: str,
        modelo: str,
        tipo: str = "",
        color: str = "",
        owner_name: str | None = None,
        owner_email: str | None = None,
    ) -> dict:
        return self.vehicle_repository.create(
            {
                "garage_id": garage_id,
                "propietario_id": propietario_id,
                "usuario_id": propietario_id,
                "user_id": propietario_id,
                "placa": placa.strip().upper(),
                "plate": placa.strip().upper(),
                "marca": marca.strip(),
                "brand": marca.strip(),
                "modelo": modelo.strip(),
                "tipo": tipo.strip(),
                "type": tipo.strip(),
                "color": color.strip(),
                "owner": owner_name,
                "owner_name": owner_name,
                "owner_email": owner_email,
            }
        )

    def update_vehicle(self, *, vehicle_id: str, payload: dict) -> dict | None:
        return self.vehicle_repository.update(vehicle_id, payload)

    def delete_vehicle(self, *, vehicle_id: str) -> bool:
        return self.vehicle_repository.delete(vehicle_id)

    def search_vehicles(self, *, garage_id: str, term: str) -> list[dict]:
        wanted = normalize_text(term)
        vehicles = self.vehicle_repository.get_by_garage(garage_id)
        if not wanted:
            return vehicles
        return [
            row
            for row in vehicles
            if wanted in normalize_text(row.get("plate"))
            or wanted in normalize_text(row.get("brand"))
            or wanted in normalize_text(row.get("model"))
            or wanted in normalize_text(row.get("owner_name"))
        ]
