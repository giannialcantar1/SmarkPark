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

    def _garage_session_ids(self, *, garage_id: str) -> set[str]:
        garage_vehicle_ids = {
            str(vehicle.get("id"))
            for vehicle in self.vehicle_repository.get_by_garage(garage_id)
            if vehicle.get("id")
        }
        session_ids: set[str] = set()
        for row in self.session_repository.get_all(order_candidates=["entrada", "created_at"], desc=True):
            if row.get("garage_id") == garage_id or str(row.get("vehicle_id")) in garage_vehicle_ids:
                if row.get("id"):
                    session_ids.add(str(row.get("id")))
        return session_ids

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
        session_ids = self._garage_session_ids(garage_id=garage_id)
        rows = self.payment_repository.get_all(order_candidates=["fecha", "created_at"], desc=True)
        return [row for row in rows if str(row.get("session_id")) in session_ids]

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
