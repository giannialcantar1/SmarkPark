from __future__ import annotations

from datetime import timedelta
from typing import Any

from config import Config
from services import ParkingService
from utils.supabase_client import normalize_parking_space, normalize_text, parse_datetime, select_rows, insert_row, update_rows, utcnow, utcnow_iso


ACTIVE_RESERVATION_STATUSES = {"reservado", "activo"}


def _user_keys(row: dict[str, Any]) -> list[str]:
    keys = {
        normalize_text(row.get("id")),
        normalize_text(row.get("auth_user_id")),
        normalize_text(row.get("user_id")),
    }
    return [key for key in keys if key]


def _reservation_overlaps(row: dict[str, Any], start_dt, end_dt) -> bool:
    row_start = parse_datetime(row.get("fecha_entrada"))
    row_end = parse_datetime(row.get("fecha_salida"))
    if not row_start or not row_end:
        return False
    return row_start < end_dt and start_dt < row_end


class ReservationService:
    def __init__(self) -> None:
        self.parking_service = ParkingService()

    def _users_by_key(self, *, garage_id: str) -> dict[str, dict[str, Any]]:
        rows = select_rows(
            "users",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["created_at", "updated_at", "email"],
            desc=True,
            limit=500,
        )
        lookup: dict[str, dict[str, Any]] = {}
        for row in rows:
            for key in _user_keys(row):
                lookup[key] = row
        return lookup

    def _vehicles_by_id(self, *, garage_id: str) -> dict[str, dict[str, Any]]:
        rows = select_rows(
            "vehicles",
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["created_at", "updated_at", "placa"],
            desc=True,
            limit=500,
        )
        return {str(row.get("id")): row for row in rows if row.get("id")}

    def _reservations(self, *, garage_id: str) -> list[dict[str, Any]]:
        return select_rows(
            "reservas",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["fecha_entrada", "created_at"],
            desc=False,
            limit=500,
        )

    def _enrich_row(
        self,
        row: dict[str, Any],
        *,
        users: dict[str, dict[str, Any]] | None = None,
        vehicles: dict[str, dict[str, Any]] | None = None,
        spaces: dict[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        users = users or {}
        vehicles = vehicles or {}
        spaces = spaces or {}

        user = users.get(normalize_text(row.get("user_id"))) or {}
        vehicle = vehicles.get(str(row.get("vehicle_id") or "")) or {}
        space = spaces.get(str(row.get("espacio_id") or "")) or {}

        return {
            **row,
            "user_name": user.get("name") or user.get("full_name") or user.get("nombre") or user.get("email") or "Usuario",
            "user_email": user.get("email") or "",
            "placa": row.get("placa") or row.get("plate") or vehicle.get("placa") or vehicle.get("plate") or "",
            "vehicle_id": row.get("vehicle_id") or vehicle.get("id"),
            "espacio_codigo": space.get("numero_mostrar") or space.get("codigo") or space.get("numero") or "",
            "floor": space.get("piso") or space.get("floor") or "",
        }

    def list_user_reservations(self, *, garage_id: str, user_id: str) -> list[dict[str, Any]]:
        users = self._users_by_key(garage_id=garage_id)
        vehicles = self._vehicles_by_id(garage_id=garage_id)
        spaces = {
            str(space.get("id")): space
            for space in self.parking_service.list_spaces(garage_id=garage_id)
            if space.get("id")
        }
        wanted = normalize_text(user_id)
        rows = []
        for row in self._reservations(garage_id=garage_id):
            if normalize_text(row.get("user_id")) != wanted:
                continue
            rows.append(self._enrich_row(row, users=users, vehicles=vehicles, spaces=spaces))
        return rows

    def list_available_spaces(self, *, garage_id: str, start_dt, end_dt) -> list[dict[str, Any]]:
        spaces = self.parking_service.list_spaces(garage_id=garage_id)
        active_sessions = self.parking_service.get_active_sessions(garage_id=garage_id)
        current_active_space_ids = {str(item.get("space_id") or item.get("espacio_id") or "") for item in active_sessions}

        blocked_space_ids: set[str] = set()
        for row in self._reservations(garage_id=garage_id):
            if normalize_text(row.get("status")) not in ACTIVE_RESERVATION_STATUSES:
                continue
            if _reservation_overlaps(row, start_dt, end_dt):
                blocked_space_ids.add(str(row.get("espacio_id") or ""))

        available: list[dict[str, Any]] = []
        now = utcnow()
        for row in spaces:
            space_id = str(row.get("id") or "")
            if not space_id:
                continue
            if space_id in blocked_space_ids:
                continue
            if start_dt <= now <= end_dt and space_id in current_active_space_ids:
                continue
            available.append(normalize_parking_space(row))
        return available

    def create_reservation(
        self,
        *,
        garage_id: str,
        user_id: str,
        fecha_entrada: str,
        fecha_salida: str,
        espacio_id: str,
        vehicle_id: str | None = None,
        placa: str | None = None,
    ) -> dict[str, Any]:
        start_dt = parse_datetime(fecha_entrada)
        end_dt = parse_datetime(fecha_salida)
        now = utcnow()
        if not start_dt or not end_dt:
            raise ValueError("Debes indicar fecha de entrada y salida validas")
        if start_dt <= now:
            raise ValueError("La reserva debe programarse para una fecha futura")
        if start_dt > now + timedelta(hours=48):
            raise ValueError("La reserva no puede superar 48 horas de anticipacion")
        if end_dt <= start_dt:
            raise ValueError("La fecha de salida debe ser mayor que la fecha de entrada")

        available_spaces = self.list_available_spaces(garage_id=garage_id, start_dt=start_dt, end_dt=end_dt)
        space = next((item for item in available_spaces if normalize_text(item.get("id")) == normalize_text(espacio_id)), None)
        if not space:
            raise ValueError("Ese espacio no esta disponible para el rango seleccionado")

        vehicle = self._vehicles_by_id(garage_id=garage_id).get(str(vehicle_id or "")) if vehicle_id else None
        resolved_plate = str(placa or vehicle.get("placa") or vehicle.get("plate") or "").strip().upper()
        if not resolved_plate:
            raise ValueError("Debes seleccionar un vehiculo o indicar una placa")

        created = insert_row(
            "reservas",
            {
                "garage_id": garage_id,
                "user_id": user_id,
                "vehicle_id": vehicle_id,
                "placa": resolved_plate,
                "espacio_id": espacio_id,
                "fecha_entrada": start_dt.isoformat(),
                "fecha_salida": end_dt.isoformat(),
                "status": "reservado",
                "created_at": utcnow_iso(),
            },
        )
        users = self._users_by_key(garage_id=garage_id)
        spaces = {str(item.get("id")): item for item in self.parking_service.list_spaces(garage_id=garage_id) if item.get("id")}
        vehicles = self._vehicles_by_id(garage_id=garage_id)
        return self._enrich_row(created, users=users, vehicles=vehicles, spaces=spaces)

    def cancel_reservation(self, *, garage_id: str, reservation_id: str, user_id: str, is_admin: bool = False) -> dict[str, Any] | None:
        rows = self._reservations(garage_id=garage_id)
        target = next((row for row in rows if normalize_text(row.get("id")) == normalize_text(reservation_id)), None)
        if not target:
            return None
        if not is_admin and normalize_text(target.get("user_id")) != normalize_text(user_id):
            return None

        update_rows(
            "reservas",
            payload={"status": "cancelado"},
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )
        target["status"] = "cancelado"
        return target

    def convert_to_entry(self, *, garage_id: str, reservation_id: str) -> dict[str, Any] | None:
        rows = self._reservations(garage_id=garage_id)
        target = next((row for row in rows if normalize_text(row.get("id")) == normalize_text(reservation_id)), None)
        if not target:
            return None
        if normalize_text(target.get("status")) not in {"reservado", "activo"}:
            raise ValueError("Solo las reservas activas o reservadas pueden convertirse en entrada")

        vehicles = self._vehicles_by_id(garage_id=garage_id)
        vehicle = vehicles.get(str(target.get("vehicle_id") or "")) or {}
        users = self._users_by_key(garage_id=garage_id)
        user = users.get(normalize_text(target.get("user_id"))) or {}
        user_name = user.get("name") or user.get("full_name") or user.get("nombre") or "Usuario"
        plate = str(target.get("placa") or vehicle.get("placa") or vehicle.get("plate") or "").strip().upper()
        if not plate:
            raise ValueError("La reserva no tiene una placa asociada")

        result = self.parking_service.register_entry(
            garage_id=garage_id,
            usuario_id=str(target.get("user_id") or ""),
            usuario_nombre=user_name,
            placa=plate,
            espacio_id=str(target.get("espacio_id") or ""),
            propietario=user_name,
            modelo=vehicle.get("modelo") or vehicle.get("model"),
            marca=vehicle.get("marca") or vehicle.get("brand"),
            tipo=vehicle.get("tipo") or vehicle.get("type"),
            color=vehicle.get("color"),
        )

        update_rows(
            "reservas",
            payload={"status": "activo"},
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )
        return {
            "reservation": {**target, "status": "activo"},
            "entry": result,
        }
