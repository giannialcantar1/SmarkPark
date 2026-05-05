from __future__ import annotations

from datetime import date
from typing import Any

from utils.supabase_client import normalize_text, parse_datetime, select_rows, insert_row, update_rows, utcnow_iso


def _user_keys(row: dict[str, Any]) -> list[str]:
    keys = {
        normalize_text(row.get("id")),
        normalize_text(row.get("auth_user_id")),
        normalize_text(row.get("user_id")),
    }
    return [key for key in keys if key]


class MonthlyPlanService:
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

    def _status_for_row(self, row: dict[str, Any]) -> str:
        raw_status = normalize_text(row.get("status"))
        if raw_status == "pagado":
            return "pagado"

        due_dt = parse_datetime(row.get("due_date"))
        if due_dt and due_dt.date() < date.today():
            return "vencido"
        return "pendiente"

    def _enrich_row(self, row: dict[str, Any], user: dict[str, Any] | None = None) -> dict[str, Any]:
        user = user or {}
        due_dt = parse_datetime(row.get("due_date"))
        status = self._status_for_row(row)
        amount = 0.0
        try:
            amount = round(float(row.get("amount") or 0), 2)
        except (TypeError, ValueError):
            amount = 0.0

        return {
            **row,
            "amount": amount,
            "status": status,
            "user_name": user.get("name") or user.get("full_name") or user.get("nombre") or user.get("email") or "Usuario",
            "user_email": user.get("email") or "",
            "days_overdue": max((date.today() - due_dt.date()).days, 0) if due_dt and status == "vencido" else 0,
        }

    def _rows(self, *, garage_id: str) -> list[dict[str, Any]]:
        return select_rows(
            "monthly_plans",
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["due_date", "created_at"],
            desc=False,
            limit=500,
        )

    def list_plans(self, *, garage_id: str) -> list[dict[str, Any]]:
        users = self._users_by_key(garage_id=garage_id)
        enriched: list[dict[str, Any]] = []
        for row in self._rows(garage_id=garage_id):
            user = users.get(normalize_text(row.get("user_id")))
            enriched.append(self._enrich_row(row, user))
        return enriched

    def get_user_plan(self, *, garage_id: str, user_id: str) -> dict[str, Any] | None:
        normalized_user_id = normalize_text(user_id)
        for row in self.list_plans(garage_id=garage_id):
            if normalize_text(row.get("user_id")) == normalized_user_id:
                return row
        return None

    def create_or_update_plan(
        self,
        *,
        garage_id: str,
        user_id: str,
        amount: float,
        due_date: str,
        status: str = "pendiente",
    ) -> dict[str, Any]:
        existing = self.get_user_plan(garage_id=garage_id, user_id=user_id)
        payload = {
            "garage_id": garage_id,
            "user_id": user_id,
            "amount": round(float(amount), 2),
            "due_date": due_date,
            "status": status,
            "created_at": utcnow_iso(),
        }
        if existing and existing.get("id"):
            update_rows(
                "monthly_plans",
                payload={key: value for key, value in payload.items() if key != "created_at"},
                filters=[{"column": "id", "value": existing.get("id"), "optional": False}],
            )
        else:
            insert_row("monthly_plans", payload)

        return self.get_user_plan(garage_id=garage_id, user_id=user_id) or payload

    def mark_paid(self, *, garage_id: str, plan_id: str | None = None, user_id: str | None = None) -> dict[str, Any] | None:
        plans = self.list_plans(garage_id=garage_id)
        target = next(
            (
                row
                for row in plans
                if (plan_id and normalize_text(row.get("id")) == normalize_text(plan_id))
                or (user_id and normalize_text(row.get("user_id")) == normalize_text(user_id))
            ),
            None,
        )
        if not target or not target.get("id"):
            return None

        update_rows(
            "monthly_plans",
            payload={"status": "pagado"},
            filters=[{"column": "id", "value": target.get("id"), "optional": False}],
        )
        return self.get_user_plan(garage_id=garage_id, user_id=str(target.get("user_id") or "")) or {**target, "status": "pagado"}

    def list_pending(self, *, garage_id: str) -> list[dict[str, Any]]:
        return [row for row in self.list_plans(garage_id=garage_id) if row.get("status") in {"pendiente", "vencido"}]

    def list_overdue(self, *, garage_id: str) -> list[dict[str, Any]]:
        return [row for row in self.list_plans(garage_id=garage_id) if row.get("status") == "vencido"]

    def stats(self, *, garage_id: str) -> dict[str, Any]:
        plans = self.list_plans(garage_id=garage_id)
        pending = [row for row in plans if row.get("status") in {"pendiente", "vencido"}]
        overdue = [row for row in plans if row.get("status") == "vencido"]
        return {
            "active_count": len(plans),
            "pending_count": len(pending),
            "overdue_count": len(overdue),
            "total_overdue_amount": round(sum(float(row.get("amount") or 0) for row in overdue), 2),
        }
