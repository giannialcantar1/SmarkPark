from __future__ import annotations

from collections import defaultdict

from repositories import ParkingSpaceRepository, PaymentRepository, SessionRepository, UserRepository, VehicleRepository
from utils.supabase_client import normalize_text, parse_datetime, utcnow


class ReportService:
    def __init__(self) -> None:
        self.space_repository = ParkingSpaceRepository()
        self.vehicle_repository = VehicleRepository()
        self.session_repository = SessionRepository()
        self.payment_repository = PaymentRepository()
        self.user_repository = UserRepository()

    def _spaces(self, *, garage_id: str) -> list[dict]:
        return self.space_repository.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["piso", "numero"],
        )

    def _vehicles(self, *, garage_id: str) -> list[dict]:
        return self.vehicle_repository.get_by_garage(garage_id)

    def _sessions(self, *, garage_id: str) -> list[dict]:
        spaces = {str(row.get("id")) for row in self._spaces(garage_id=garage_id)}
        vehicles = {str(row.get("id")) for row in self._vehicles(garage_id=garage_id)}
        result: list[dict] = []
        for row in self.session_repository.get_all(order_candidates=["entrada", "created_at"], desc=True):
            if row.get("garage_id") == garage_id or str(row.get("space_id")) in spaces or str(row.get("vehicle_id")) in vehicles:
                result.append(row)
        return result

    def generate_occupancy_report(self, *, garage_id: str) -> dict:
        spaces = self._spaces(garage_id=garage_id)
        total = len(spaces)
        occupied = sum(1 for row in spaces if row.get("occupied"))
        available = max(total - occupied, 0)
        floors: dict[str, dict[str, int]] = defaultdict(lambda: {"occupied": 0, "available": 0})

        for row in spaces:
            floor = row.get("floor") or "Sin piso"
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
            "total_spaces": total,
            "occupied_spaces": occupied,
            "available_spaces": available,
            "occupancy_percentage": round((occupied / total) * 100) if total else 0,
            "floor_stats": floor_stats,
        }

    def generate_income_report(self, *, garage_id: str) -> dict:
        session_ids = {str(row.get("id")) for row in self._sessions(garage_id=garage_id) if row.get("id")}
        payments = self.payment_repository.get_all(order_candidates=["fecha", "created_at"], desc=True)
        total = 0.0
        today_total = 0.0
        today = utcnow().date()

        for row in payments:
            session_id = str(row.get("session_id") or "")
            if session_id not in session_ids:
                continue
            amount = float(row.get("monto") or row.get("amount") or 0)
            total += amount
            paid_at = parse_datetime(row.get("fecha") or row.get("created_at"))
            if paid_at and paid_at.date() == today:
                today_total += amount

        return {
            "total_income": round(total, 2),
            "today_income": round(today_total, 2),
            "payments_count": len([row for row in payments if str(row.get("session_id") or "") in session_ids]),
        }

    def generate_vehicle_report(self, *, garage_id: str) -> dict:
        vehicles = self._vehicles(garage_id=garage_id)
        summary = {"total": len(vehicles), "by_type": {}, "items": vehicles}
        for row in vehicles:
            vehicle_type = row.get("type") or "Sin tipo"
            summary["by_type"][vehicle_type] = summary["by_type"].get(vehicle_type, 0) + 1
        return summary

    def generate_user_report(self, *, garage_id: str) -> dict:
        users = self.user_repository.get_all(
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["created_at", "nombre", "email"],
            desc=True,
        )
        summary = {"total": len(users), "by_role": {}, "items": users}
        for row in users:
            role = normalize_text(row.get("rol") or row.get("role")) or "usuario"
            summary["by_role"][role] = summary["by_role"].get(role, 0) + 1
        return summary
