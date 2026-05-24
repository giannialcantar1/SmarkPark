from __future__ import annotations

from math import ceil

from config import Config
from repositories import ParkingSpaceRepository, SessionRepository, VehicleRepository
from utils.supabase_client import get_hourly_rate, insert_row, normalize_parking_space, normalize_session, normalize_text, parse_datetime, select_rows, update_rows, utcnow, utcnow_iso


class ParkingService:
    def __init__(self) -> None:
        self.space_repository = ParkingSpaceRepository()
        self.session_repository = SessionRepository()
        self.vehicle_repository = VehicleRepository()

    def _space_floor_label(self, index: int) -> str:
        floor_label = ""
        current = max(0, int(index))
        while True:
            current, remainder = divmod(current, 26)
            floor_label = chr(ord("A") + remainder) + floor_label
            if current == 0:
                return floor_label
            current -= 1

    def _vehicles(self, *, garage_id: str) -> list[dict]:
        return self.vehicle_repository.get_by_garage(garage_id)

    def _spaces(self, *, garage_id: str) -> list[dict]:
        spaces = self.space_repository.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["piso", "numero", "created_at"],
        )
        if spaces or not garage_id:
            return spaces
        return self._create_default_spaces(garage_id=garage_id, count=20)

    def _create_default_spaces(self, *, garage_id: str, count: int) -> list[dict]:
        rows = []
        for index in range(max(0, count)):
            floor_index = index // 20
            floor = self._space_floor_label(floor_index)
            number = f"{floor}{(index % 20) + 1}"
            space = self.space_repository.create(
                {
                    "numero": number,
                    "codigo": number,
                    "piso": floor,
                    "ocupado": False,
                    "estado": "disponible",
                    "status": "available",
                    "tipo_espacio": "regular",
                    "garage_id": garage_id,
                }
            )
            if space:
                rows.append(space)
        return rows

    def _sessions(self, *, garage_id: str) -> list[dict]:
        vehicles_by_id = {str(row.get("id")): row for row in self._vehicles(garage_id=garage_id) if row.get("id")}
        spaces_by_id = {str(row.get("id")): row for row in self._spaces(garage_id=garage_id) if row.get("id")}
        spaces_by_code = {normalize_text(row.get("code")): row for row in spaces_by_id.values() if row.get("code")}
        sessions: list[dict] = []
        for row in self.session_repository.get_all(order_candidates=["entrada", "entry_time", "created_at"], desc=True):
            vehicle = vehicles_by_id.get(str(row.get("vehicle_id")))
            space = spaces_by_id.get(str(row.get("space_id")))
            if not space:
                space = spaces_by_code.get(normalize_text(row.get("space_code") or row.get("espacio")))
            if row.get("garage_id") == garage_id or vehicle or space:
                normalized = dict(row)
                if vehicle and not normalized.get("plate"):
                    normalized["plate"] = vehicle.get("plate")
                if vehicle and not normalized.get("owner_name"):
                    normalized["owner_name"] = vehicle.get("owner_name")
                if space and not normalized.get("space_id"):
                    normalized["space_id"] = space.get("id")
                    normalized["espacio_id"] = space.get("id")
                if space and not normalized.get("space_code"):
                    normalized["space_code"] = space.get("code")
                    normalized["espacio"] = space.get("code")
                sessions.append(normalized)
        return sessions

    def _active_session_space_keys(self, *, garage_id: str) -> set[str]:
        keys: set[str] = set()
        for session in self.get_active_sessions(garage_id=garage_id):
            for key in ("space_id", "espacio_id", "space_code", "espacio"):
                value = normalize_text(session.get(key))
                if value:
                    keys.add(value)
        return keys

    def _apply_session_occupancy(self, spaces: list[dict], *, garage_id: str) -> list[dict]:
        active_space_keys = self._active_session_space_keys(garage_id=garage_id)
        if not active_space_keys:
            return spaces

        normalized_spaces: list[dict] = []
        for space in spaces:
            space_keys = {
                normalize_text(space.get("id")),
                normalize_text(space.get("code")),
                normalize_text(space.get("codigo")),
                normalize_text(space.get("numero")),
            }
            is_occupied_by_session = any(key and key in active_space_keys for key in space_keys)
            if is_occupied_by_session and not space.get("occupied"):
                normalized_spaces.append(
                    normalize_parking_space(
                        {
                            **space,
                            "ocupado": True,
                            "estado": "ocupado",
                            "status": "occupied",
                        }
                    )
                )
            else:
                normalized_spaces.append(space)
        return normalized_spaces

    def list_spaces(self, *, garage_id: str, floor: str | None = None, only_available: bool = False) -> list[dict]:
        spaces = self._apply_session_occupancy(self._spaces(garage_id=garage_id), garage_id=garage_id)
        if only_available:
            spaces = [space for space in spaces if not space.get("occupied")]
        if floor:
            wanted = normalize_text(floor)
            spaces = [space for space in spaces if normalize_text(space.get("floor")) == wanted]
        return spaces

    def get_available_spaces(self, *, garage_id: str) -> list[dict]:
        return [space for space in self.list_spaces(garage_id=garage_id) if not space.get("occupied")]

    def get_space_stats(self, *, garage_id: str) -> dict:
        spaces = self.list_spaces(garage_id=garage_id)
        total = len(spaces)
        occupied = sum(1 for row in spaces if row.get("occupied"))
        available = max(total - occupied, 0)
        floors: dict[str, dict[str, int]] = {}
        for row in spaces:
            floor = row.get("floor") or "Sin piso"
            floors.setdefault(floor, {"occupied": 0, "available": 0})
            if row.get("occupied"):
                floors[floor]["occupied"] += 1
            else:
                floors[floor]["available"] += 1
        floor_stats = []
        for floor in sorted(floors):
            floor_total = floors[floor]["occupied"] + floors[floor]["available"]
            floor_stats.append(
                {
                    "floor": floor,
                    "occupied": floors[floor]["occupied"],
                    "available": floors[floor]["available"],
                    "percentage": round((floors[floor]["occupied"] / floor_total) * 100) if floor_total else 0,
                }
            )
        return {
            "total": total,
            "occupied": occupied,
            "available": available,
            "occupancyPercentage": round((occupied / total) * 100) if total else 0,
            "floorStats": floor_stats,
        }

    def get_active_sessions(self, *, garage_id: str) -> list[dict]:
        vehicles_by_id = {str(row.get("id")): row for row in self._vehicles(garage_id=garage_id) if row.get("id")}
        spaces_by_id = {str(row.get("id")): row for row in self._spaces(garage_id=garage_id) if row.get("id")}
        spaces_by_code = {normalize_text(row.get("code")): row for row in spaces_by_id.values() if row.get("code")}
        active_rows = []
        for row in self.session_repository.get_active_sessions():
            if row.get("garage_id") != garage_id and str(row.get("vehicle_id")) not in vehicles_by_id:
                continue
            vehicle = vehicles_by_id.get(str(row.get("vehicle_id")))
            space = spaces_by_id.get(str(row.get("space_id"))) or spaces_by_code.get(normalize_text(row.get("space_code") or row.get("espacio")))
            active_rows.append(
                {
                    **row,
                    "plate": row.get("plate") or (vehicle or {}).get("plate") or "",
                    "owner_name": row.get("owner_name") or (vehicle or {}).get("owner_name") or "",
                    "space_id": row.get("space_id") or (space or {}).get("id"),
                    "espacio_id": row.get("espacio_id") or (space or {}).get("id"),
                    "space_code": row.get("space_code") or row.get("espacio") or (space or {}).get("code") or "",
                    "espacio": row.get("espacio") or (space or {}).get("code") or "",
                    "vehicle": vehicle,
                    "space": space,
                }
            )
        return active_rows

    def list_sessions(self, *, garage_id: str) -> list[dict]:
        vehicles_by_id = {str(row.get("id")): row for row in self._vehicles(garage_id=garage_id) if row.get("id")}
        spaces_by_id = {str(row.get("id")): row for row in self._spaces(garage_id=garage_id) if row.get("id")}
        sessions = []
        for row in self._sessions(garage_id=garage_id):
            vehicle = vehicles_by_id.get(str(row.get("vehicle_id") or row.get("vehiculo_id")))
            space = spaces_by_id.get(str(row.get("space_id") or row.get("espacio_id")))
            normalized = normalize_session(row)
            sessions.append(
                {
                    **normalized,
                    "plate": normalized.get("plate") or (vehicle or {}).get("plate") or "",
                    "placa": normalized.get("plate") or (vehicle or {}).get("plate") or "",
                    "owner_name": normalized.get("owner_name") or (vehicle or {}).get("owner_name") or "",
                    "propietario": normalized.get("owner_name") or (vehicle or {}).get("owner_name") or "",
                    "brand": (vehicle or {}).get("brand") or "",
                    "marca": (vehicle or {}).get("brand") or "",
                    "model": (vehicle or {}).get("model") or "",
                    "modelo": (vehicle or {}).get("model") or "",
                    "space_code": normalized.get("space_code") or (space or {}).get("code") or "",
                    "espacio": normalized.get("space_code") or (space or {}).get("code") or "",
                }
            )
        return sessions

    def update_space_status(self, *, garage_id: str, space_id: str, status: str) -> dict | None:
        current_space = next((row for row in self._spaces(garage_id=garage_id) if str(row.get("id")) == str(space_id)), None)
        if not current_space:
            return None
        updated = self.space_repository.update_in_garage(
            space_id,
            garage_id,
            {
                "ocupado": status == "occupied",
                "estado": "ocupado" if status == "occupied" else "disponible",
                "status": status,
                "vehiculo_id": current_space.get("vehiculo_id") if status == "occupied" else None,
            },
        )
        return updated or normalize_parking_space({**current_space, "status": status})

    def register_entry(
        self,
        *,
        garage_id: str,
        usuario_id: str,
        usuario_nombre: str,
        placa: str,
        espacio_id: str | None = None,
        propietario: str | None = None,
        modelo: str | None = None,
        marca: str | None = None,
        tipo: str | None = None,
        color: str | None = None,
    ) -> dict:
        normalized_plate = placa.strip().upper()
        vehicle = next(
            (row for row in self._vehicles(garage_id=garage_id) if normalize_text(row.get("plate")) == normalize_text(normalized_plate)),
            None,
        )
        if not vehicle:
            vehicle = self.vehicle_repository.create(
                {
                    "garage_id": garage_id,
                    "propietario_id": usuario_id,
                    "usuario_id": usuario_id,
                    "user_id": usuario_id,
                    "placa": normalized_plate,
                    "plate": normalized_plate,
                    "marca": (marca or "Sin marca").strip(),
                    "brand": (marca or "Sin marca").strip(),
                    "modelo": (modelo or "No especificado").strip(),
                    "model": (modelo or "No especificado").strip(),
                    "tipo": (tipo or "auto").strip(),
                    "type": (tipo or "auto").strip(),
                    "color": (color or "").strip(),
                    "propietario": (propietario or usuario_nombre or "").strip(),
                    "owner_name": (propietario or usuario_nombre or "").strip(),
                    "owner_email": "",
                    "status": "dentro",
                    "estado": "dentro",
                    "is_active": True,
                }
            )
            if not vehicle:
                raise ValueError("No fue posible crear el vehiculo")

        active = next(
            (
                row
                for row in self._sessions(garage_id=garage_id)
                if normalize_text(row.get("plate")) == normalize_text(normalized_plate) and not row.get("exit_time")
            ),
            None,
        )
        if active:
            raise ValueError("El vehiculo ya tiene una sesion activa")

        spaces = self._spaces(garage_id=garage_id)
        if espacio_id:
            wanted_space = normalize_text(espacio_id)
            space = next(
                (
                    row
                    for row in spaces
                    if normalize_text(row.get("id")) == wanted_space or normalize_text(row.get("code")) == wanted_space
                ),
                None,
            )
            if not space:
                raise ValueError("Espacio no encontrado")
            if space.get("occupied"):
                raise ValueError("El espacio seleccionado ya esta ocupado")
        else:
            space = next((row for row in spaces if not row.get("occupied")), None)
        if not space:
            raise ValueError("No hay espacios disponibles")

        entry_time = utcnow_iso()
        session_row = self.session_repository.create(
            {
                "garage_id": garage_id,
                "vehiculo_id": vehicle.get("id"),
                "vehicle_id": vehicle.get("id"),
                "usuario_id": usuario_id,
                "user_id": usuario_id,
                "espacio_id": space.get("id"),
                "space_id": space.get("id"),
                "espacio": space.get("code"),
                "space_code": space.get("code"),
                "entrada": entry_time,
                "entry_time": entry_time,
                "hora_inicio": entry_time,
                "duracion": 0,
                "status": "active",
                "estado": "activo",
                "is_active": True,
            }
        )
        self.space_repository.update_in_garage(
            str(space.get("id")),
            garage_id,
            {
                "ocupado": True,
                "estado": "ocupado",
                "status": "occupied",
                "vehiculo_id": vehicle.get("id"),
            },
        )
        self.vehicle_repository.update(
            str(vehicle.get("id")),
            {
                "espacio_id": space.get("id"),
                "space_id": space.get("id"),
                "status": "dentro",
                "estado": "dentro",
                "is_active": True,
            },
        )

        return {
            "session": normalize_session(
                {
                    **(session_row or {}),
                    "placa": normalized_plate,
                    "owner_name": vehicle.get("owner_name") or propietario or usuario_nombre,
                    "espacio": space.get("code"),
                    "space_code": space.get("code"),
                }
            ),
            "space": normalize_parking_space({**space, "ocupado": True}),
            "message": "Entrada registrada correctamente",
        }

    def register_exit(
        self,
        *,
        garage_id: str,
        placa: str,
        payment_method: str = "",
        payment_reference: str = "",
    ) -> dict:
        normalized_plate = placa.strip().upper()
        normalized_payment_method = payment_method.strip().lower() or "checkout"
        normalized_payment_reference = payment_reference.strip()
        vehicles_by_id = {str(row.get("id")): row for row in self._vehicles(garage_id=garage_id) if row.get("id")}
        session = next(
            (
                row
                for row in self._sessions(garage_id=garage_id)
                if normalize_text(row.get("plate")) == normalize_text(normalized_plate) and not row.get("exit_time")
            ),
            None,
        )
        if not session:
            raise ValueError("No existe una sesion activa para esa placa")

        exit_time_dt = utcnow()
        entry_time_dt = parse_datetime(session.get("entry_time")) or exit_time_dt
        duration_minutes = max(1, ceil((exit_time_dt - entry_time_dt).total_seconds() / 60))
        hourly_rate = get_hourly_rate(garage_id, fallback=Config.DEFAULT_HOURLY_RATE)
        amount = round(max(1, ceil(duration_minutes / 60)) * hourly_rate, 2)
        exit_time = exit_time_dt.isoformat()

        updated = self.session_repository.update(
            str(session.get("id")),
            {
                "salida": exit_time,
                "hora_fin": exit_time,
                "duracion": duration_minutes,
                "costo": amount,
                "monto_total": amount,
                "payment_status": "paid",
                "paid": True,
                "paid_at": exit_time,
                "status": "completed",
                "estado": "finalizado",
                "is_active": False,
            },
        )

        if session.get("space_id"):
            self.space_repository.update_in_garage(
                str(session.get("space_id")),
                garage_id,
                {
                    "ocupado": False,
                    "estado": "disponible",
                    "status": "available",
                    "vehiculo_id": None,
                },
            )

        vehicle = vehicles_by_id.get(str(session.get("vehicle_id")))
        if vehicle:
            self.vehicle_repository.update(
                str(vehicle.get("id")),
                {
                    "espacio_id": None,
                    "space_id": None,
                    "status": "fuera",
                    "estado": "fuera",
                    "is_active": False,
                },
            )
        normalized = normalize_session(updated or {**session, "salida": exit_time, "duracion": duration_minutes})
        normalized["salida"] = exit_time
        normalized["exit_time"] = exit_time
        normalized["duration_minutes"] = duration_minutes
        normalized["duracion"] = duration_minutes
        normalized["amount"] = amount
        normalized["monto_total"] = amount
        normalized["payment_status"] = "paid"
        normalized["paid"] = True
        normalized["paid_at"] = exit_time
        normalized["is_active"] = False
        normalized["metodo"] = normalized_payment_method
        normalized["payment_method"] = normalized_payment_method
        normalized["referencia"] = normalized_payment_reference
        normalized["payment_reference"] = normalized_payment_reference
        if not normalized.get("plate"):
            normalized["plate"] = session.get("plate") or (vehicle or {}).get("plate") or normalized_plate
            normalized["placa"] = normalized["plate"]
        if not normalized.get("owner_name"):
            normalized["owner_name"] = session.get("owner_name") or (vehicle or {}).get("owner_name") or ""

        payment = {}
        session_id = str(session.get("id") or "")
        if session_id:
            existing_payment = select_rows(
                "payments",
                filters=[{"column": "session_id", "value": session_id, "optional": False}],
                limit=1,
            )
            if existing_payment:
                updated_payment = update_rows(
                    "payments",
                    payload={
                        "metodo": normalized_payment_method,
                        "payment_method": normalized_payment_method,
                        "method": normalized_payment_method,
                        "referencia": normalized_payment_reference,
                        "payment_reference": normalized_payment_reference,
                        "reference": normalized_payment_reference,
                        "estado": "pagado",
                        "status": "paid",
                        "fecha": exit_time,
                        "paid_at": exit_time,
                    },
                    filters=[{"column": "id", "value": existing_payment[0].get("id"), "optional": False}],
                )
                payment = updated_payment[0] if updated_payment else {**existing_payment[0], "metodo": normalized_payment_method}
            else:
                payment = insert_row(
                    "payments",
                    {
                        "garage_id": garage_id,
                        "session_id": session_id,
                        "parking_session_id": session_id,
                        "monto": amount,
                        "amount": amount,
                        "metodo": normalized_payment_method,
                        "payment_method": normalized_payment_method,
                        "method": normalized_payment_method,
                        "referencia": normalized_payment_reference,
                        "payment_reference": normalized_payment_reference,
                        "reference": normalized_payment_reference,
                        "estado": "pagado",
                        "status": "paid",
                        "fecha": exit_time,
                        "paid_at": exit_time,
                        "created_at": exit_time,
                    },
                )
        return {
            "session": normalized,
            "payment": payment,
            "duration_minutes": duration_minutes,
            "amount_to_pay": amount,
            "message": "Salida registrada correctamente",
        }
