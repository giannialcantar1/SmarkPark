from __future__ import annotations

from math import ceil

from config import Config
from repositories import PaymentRepository, SessionRepository, VehicleRepository
from utils.supabase_client import get_hourly_rate, parse_datetime, utcnow, utcnow_iso


class PaymentService:
    def __init__(self) -> None:
        self.payment_repository = PaymentRepository()
        self.session_repository = SessionRepository()
        self.vehicle_repository = VehicleRepository()

    def calculate_payment(self, *, garage_id: str, entrada, salida=None) -> dict:
        start = parse_datetime(entrada) or utcnow()
        end = parse_datetime(salida) or utcnow()
        duration_minutes = max(1, ceil((end - start).total_seconds() / 60))
        hourly_rate = get_hourly_rate(garage_id, fallback=Config.DEFAULT_HOURLY_RATE)
        amount = round(max(1, ceil(duration_minutes / 60)) * hourly_rate, 2)
        return {
            "duration_minutes": duration_minutes,
            "hourly_rate": hourly_rate,
            "amount": amount,
        }

    def _garage_sessions(self, *, garage_id: str) -> dict[str, dict]:
        garage_vehicle_ids = {str(vehicle.get("id")) for vehicle in self.vehicle_repository.get_by_garage(garage_id) if vehicle.get("id")}
        sessions: dict[str, dict] = {}
        for row in self.session_repository.get_all(order_candidates=["entrada", "created_at"], desc=True):
            if row.get("garage_id") == garage_id or str(row.get("vehicle_id")) in garage_vehicle_ids:
                if row.get("id"):
                    sessions[str(row.get("id"))] = row
        return sessions

    def _garage_session_ids(self, *, garage_id: str) -> set[str]:
        return set(self._garage_sessions(garage_id=garage_id).keys())

    def process_payment(self, *, session_id: str, monto: float, metodo: str) -> dict:
        payment = self.payment_repository.create(
            {
                "session_id": session_id,
                "monto": round(float(monto), 2),
                "metodo": metodo,
                "estado": "pagado",
                "fecha": utcnow_iso(),
            }
        )
        self.session_repository.update(
            session_id,
            {"payment_status": "paid", "paid": True, "paid_at": utcnow_iso()},
        )
        return payment or {}

    def list_payments(self, *, garage_id: str) -> list[dict]:
        sessions = self._garage_sessions(garage_id=garage_id)
        vehicles = {
            str(vehicle.get("id")): vehicle
            for vehicle in self.vehicle_repository.get_by_garage(garage_id)
            if vehicle.get("id")
        }
        rows = self.payment_repository.get_all(order_candidates=["fecha", "created_at"], desc=True)
        enriched_rows: list[dict] = []
        for row in rows:
            session = sessions.get(str(row.get("session_id")))
            if not session:
                continue
            vehicle = vehicles.get(str(session.get("vehicle_id") or ""))
            enriched_rows.append(self._with_vehicle_display(row, session=session, vehicle=vehicle))
        return enriched_rows

    @staticmethod
    def _vehicle_name(vehicle: dict | None) -> str:
        if not vehicle:
            return ""
        combined = str(vehicle.get("marca_modelo") or vehicle.get("brand_model") or vehicle.get("vehicle_name") or "").strip()
        if combined:
            return combined
        brand = str(vehicle.get("marca") or vehicle.get("brand") or "").strip()
        model = str(vehicle.get("modelo") or vehicle.get("model") or "").strip()
        return " ".join(part for part in (brand, model) if part).strip()

    @classmethod
    def _with_vehicle_display(cls, row: dict, *, session: dict, vehicle: dict | None) -> dict:
        enriched = dict(row)
        plate = str((vehicle or {}).get("placa") or (vehicle or {}).get("plate") or session.get("placa") or session.get("plate") or "").strip().upper()
        vehicle_name = cls._vehicle_name(vehicle)
        if plate:
            enriched.setdefault("placa", plate)
            enriched.setdefault("plate", plate)
        if vehicle:
            enriched.setdefault("vehicle_id", vehicle.get("id"))
            enriched.setdefault("marca", vehicle.get("marca") or vehicle.get("brand"))
            enriched.setdefault("brand", vehicle.get("brand") or vehicle.get("marca"))
            enriched.setdefault("modelo", vehicle.get("modelo") or vehicle.get("model"))
            enriched.setdefault("model", vehicle.get("model") or vehicle.get("modelo"))
        if vehicle_name:
            enriched.setdefault("vehiculo", vehicle_name)
            enriched.setdefault("vehicle_name", vehicle_name)
        if plate and vehicle_name:
            display = f"{plate} - {vehicle_name}"
        else:
            display = plate or vehicle_name
        if display:
            enriched["vehiculo_display"] = display
            enriched["vehicle_display"] = display
        return enriched

    def get_invoice(self, *, session_id: str) -> dict | None:
        payments = self.payment_repository.get_by_session(session_id)
        session = self.session_repository.get_by_id(session_id)
        if not session:
            return None
        return {
            "session": session,
            "payment": payments[0] if payments else None,
        }

    def session_belongs_to_garage(self, *, garage_id: str, session_id: str) -> bool:
        return str(session_id) in self._garage_session_ids(garage_id=garage_id)
