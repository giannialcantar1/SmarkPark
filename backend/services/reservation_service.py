from __future__ import annotations

from datetime import timedelta
from typing import Any

from config import Config
from services import ParkingService
from services.user_service import UserService
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


def _reservation_space_id(row: dict[str, Any]) -> str:
    return str(row.get("parking_space_id") or row.get("espacio_id") or "")


def _reservation_status(row: dict[str, Any]) -> str:
    return str(row.get("estado") or row.get("status") or "").strip().lower()


class ReservationService:
    def __init__(self) -> None:
        self.parking_service = ParkingService()
        self.user_service = UserService()

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

    def _resolve_user_context(self, *, garage_id: str, user_id: str) -> tuple[dict[str, Any] | None, set[str]]:
        normalized_requested = normalize_text(user_id)
        user = self.user_service.get_user(user_id=user_id)
        if user and garage_id and normalize_text(user.get("garage_id")) not in {"", normalize_text(garage_id)}:
            user = None

        accepted_keys = {
            normalized_requested,
            normalize_text((user or {}).get("id")),
            normalize_text((user or {}).get("auth_user_id")),
            normalize_text((user or {}).get("user_id")),
        }
        return user, {key for key in accepted_keys if key}

    def _reservations(self, *, garage_id: str) -> list[dict[str, Any]]:
        return select_rows(
            "reservations",
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

        user = users.get(normalize_text(row.get("user_id"))) or users.get(normalize_text(row.get("auth_user_id"))) or {}
        vehicle = vehicles.get(str(row.get("vehicle_id") or "")) or {}
        resolved_space_id = _reservation_space_id(row)
        resolved_status = _reservation_status(row)
        space = spaces.get(resolved_space_id) or {}

        return {
            **row,
            "parking_space_id": resolved_space_id or row.get("parking_space_id"),
            "espacio_id": resolved_space_id or row.get("espacio_id"),
            "estado": resolved_status or row.get("estado"),
            "status": resolved_status or row.get("status"),
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
        _, wanted_keys = self._resolve_user_context(garage_id=garage_id, user_id=user_id)
        rows = []
        for row in self._reservations(garage_id=garage_id):
            row_keys = {
                normalize_text(row.get("user_id")),
                normalize_text(row.get("auth_user_id")),
            }
            if not wanted_keys.intersection({key for key in row_keys if key}):
                continue
            rows.append(self._enrich_row(row, users=users, vehicles=vehicles, spaces=spaces))
        return rows

    def list_available_spaces(self, *, garage_id: str, start_dt, end_dt) -> list[dict[str, Any]]:
        spaces = self.parking_service.list_spaces(garage_id=garage_id)
        active_sessions = self.parking_service.get_active_sessions(garage_id=garage_id)
        current_active_space_ids = {str(item.get("space_id") or item.get("espacio_id") or "") for item in active_sessions}

        blocked_space_ids: set[str] = set()
        for row in self._reservations(garage_id=garage_id):
            if _reservation_status(row) not in ACTIVE_RESERVATION_STATUSES:
                continue
            if _reservation_overlaps(row, start_dt, end_dt):
                blocked_space_ids.add(_reservation_space_id(row))

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

        user, _ = self._resolve_user_context(garage_id=garage_id, user_id=user_id)
        stored_user_id = str((user or {}).get("id") or user_id).strip()
        auth_user_id = str((user or {}).get("auth_user_id") or (user or {}).get("user_id") or user_id).strip()

        created = insert_row(
            "reservations",
            {
                "garage_id": garage_id,
                "user_id": stored_user_id,
                "auth_user_id": auth_user_id,
                "vehicle_id": vehicle_id,
                "placa": resolved_plate,
                "parking_space_id": espacio_id,
                "fecha_entrada": start_dt.isoformat(),
                "fecha_salida": end_dt.isoformat(),
                "estado": "reservado",
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
        _, allowed_keys = self._resolve_user_context(garage_id=garage_id, user_id=user_id)
        target_keys = {
            normalize_text(target.get("user_id")),
            normalize_text(target.get("auth_user_id")),
        }
        if not is_admin and not allowed_keys.intersection({key for key in target_keys if key}):
            return None

        update_rows(
            "reservations",
            payload={"estado": "cancelado"},
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )
        target["estado"] = "cancelado"
        target["status"] = "cancelado"
        return target

    def convert_to_entry(self, *, garage_id: str, reservation_id: str) -> dict[str, Any] | None:
        rows = self._reservations(garage_id=garage_id)
        target = next((row for row in rows if normalize_text(row.get("id")) == normalize_text(reservation_id)), None)
        if not target:
            return None
        if _reservation_status(target) not in {"reservado", "activo"}:
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
            espacio_id=_reservation_space_id(target),
            propietario=user_name,
            modelo=vehicle.get("modelo") or vehicle.get("model"),
            marca=vehicle.get("marca") or vehicle.get("brand"),
            tipo=vehicle.get("tipo") or vehicle.get("type"),
            color=vehicle.get("color"),
        )

        update_rows(
            "reservations",
            payload={"estado": "activo"},
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )
        return {
            "reservation": {**target, "estado": "activo", "status": "activo"},
            "entry": result,
        }
