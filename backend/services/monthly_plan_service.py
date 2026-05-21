from __future__ import annotations

from datetime import date
from typing import Any

from postgrest.exceptions import APIError

from services.user_service import UserService
from utils.supabase_client import (
    get_user_table_client,
    normalize_text,
    parse_datetime,
    select_rows,
    insert_row,
    update_rows,
    utcnow_iso,
)


def _user_keys(row: dict[str, Any]) -> list[str]:
    keys = {
        normalize_text(row.get("id")),
        normalize_text(row.get("auth_user_id")),
        normalize_text(row.get("user_id")),
    }
    return [key for key in keys if key]


class MonthlyPlanService:
    def __init__(self) -> None:
        self.user_service = UserService()
        self._table_available: bool | None = None

    def _ensure_table_available(self) -> None:
        if self._table_available is True:
            return
        if self._table_available is False:
            raise RuntimeError(
                "La tabla public.monthly_plans no existe en Supabase. Ejecuta backend/sql/2026-05-04_monthly_plans.sql para habilitar mensualidades."
            )

        try:
            get_user_table_client(use_admin=True).table("monthly_plans").select("id").limit(1).execute()
            self._table_available = True
        except APIError as exc:
            message = str(exc or "")
            if "public.monthly_plans" in message:
                self._table_available = False
                raise RuntimeError(
                    "La tabla public.monthly_plans no existe en Supabase. Ejecuta backend/sql/2026-05-04_monthly_plans.sql para habilitar mensualidades."
                ) from exc
            raise

    def _users_by_key(self, *, garage_id: str) -> dict[str, dict[str, Any]]:
        rows = self.user_service.list_users(garage_id=garage_id)
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
        self._ensure_table_available()
        return select_rows(
            "monthly_plans",
            filters=[{"column": "garage_id", "value": garage_id, "optional": False}],
            order_candidates=["due_date", "created_at"],
            desc=False,
            limit=500,
        )

    @staticmethod
    def _user_group_key(row: dict[str, Any]) -> str:
        return (
            normalize_text(row.get("user_id"))
            or normalize_text(row.get("auth_user_id"))
            or normalize_text(row.get("user_email"))
            or normalize_text(row.get("email"))
            or normalize_text(row.get("id"))
        )

    @staticmethod
    def _to_amount(value: Any) -> float:
        try:
            return round(float(value or 0), 2)
        except (TypeError, ValueError):
            return 0.0

    def _list_payment_rows(self, *, garage_id: str) -> list[dict[str, Any]]:
        return select_rows(
            "monthly_plan_payments",
            filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
            order_candidates=["paid_at", "created_at"],
            desc=True,
            limit=1000,
        )

    def _latest_payments_by_user(self, *, garage_id: str, plans: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        plan_user_by_id = {
            normalize_text(row.get("id")): self._user_group_key(row)
            for row in plans
            if row.get("id")
        }
        latest_by_user: dict[str, dict[str, Any]] = {}

        for row in self._list_payment_rows(garage_id=garage_id):
            user_key = (
                normalize_text(row.get("user_id"))
                or plan_user_by_id.get(normalize_text(row.get("plan_id")))
            )
            if not user_key or user_key in latest_by_user:
                continue

            latest_by_user[user_key] = {
                "fecha": row.get("paid_at") or row.get("created_at"),
                "monto": self._to_amount(row.get("amount")),
                "referencia": row.get("reference") or "",
                "metodo": row.get("method") or "",
                "estado": row.get("status") or "",
            }

        return latest_by_user

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
        self._ensure_table_available()
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

        persisted = self.get_user_plan(garage_id=garage_id, user_id=user_id)
        if not persisted:
            raise RuntimeError(
                "No se pudo confirmar el guardado del plan mensual en Supabase."
            )
        return persisted

    def mark_paid(self, *, garage_id: str, plan_id: str | None = None, user_id: str | None = None) -> dict[str, Any] | None:
        self._ensure_table_available()
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

    def list_overdue_users(
        self,
        *,
        garage_id: str,
        search: str = "",
        min_days: int | None = None,
        max_days: int | None = None,
    ) -> list[dict[str, Any]]:
        plans = self.list_plans(garage_id=garage_id)
        overdue_plans = [row for row in plans if row.get("status") == "vencido"]
        pending_plans = [row for row in plans if row.get("status") in {"pendiente", "vencido"}]

        pending_count_by_user: dict[str, int] = {}
        for row in pending_plans:
            user_key = self._user_group_key(row)
            if not user_key:
                continue
            pending_count_by_user[user_key] = pending_count_by_user.get(user_key, 0) + 1

        latest_payment_by_user = self._latest_payments_by_user(garage_id=garage_id, plans=plans)
        aggregated: dict[str, dict[str, Any]] = {}

        for row in overdue_plans:
            user_key = self._user_group_key(row)
            if not user_key:
                continue

            due_date = row.get("due_date")
            company_name = (
                row.get("company_name")
                or row.get("empresa")
                or row.get("garage_name")
                or row.get("company")
                or ""
            )

            current = aggregated.setdefault(
                user_key,
                {
                    "id": row.get("user_id") or row.get("id") or user_key,
                    "user_id": row.get("user_id"),
                    "usuario": row.get("user_name") or row.get("user_email") or "Usuario",
                    "usuario_email": row.get("user_email") or "",
                    "garaje": company_name or garage_id,
                    "garage_id": garage_id,
                    "deuda_total": 0.0,
                    "dias_vencidos": 0,
                    "ultimo_pago": latest_payment_by_user.get(user_key),
                    "planes_pendientes": pending_count_by_user.get(user_key, 0),
                    "plan_ids": [],
                    "ultimo_vencimiento": due_date,
                    "status": "moroso",
                },
            )

            current["deuda_total"] = round(current["deuda_total"] + self._to_amount(row.get("amount")), 2)
            current["dias_vencidos"] = max(int(current.get("dias_vencidos") or 0), int(row.get("days_overdue") or 0))
            current["planes_pendientes"] = max(int(current.get("planes_pendientes") or 0), pending_count_by_user.get(user_key, 0))
            current["plan_ids"].append(row.get("id"))

            current_due = parse_datetime(current.get("ultimo_vencimiento"))
            candidate_due = parse_datetime(due_date)
            if candidate_due and (current_due is None or candidate_due < current_due):
                current["ultimo_vencimiento"] = due_date

        normalized_search = normalize_text(search)
        rows: list[dict[str, Any]] = []
        for current in aggregated.values():
            dias_vencidos = int(current.get("dias_vencidos") or 0)
            if min_days is not None and dias_vencidos < min_days:
                continue
            if max_days is not None and dias_vencidos > max_days:
                continue

            if normalized_search:
                haystack = " ".join(
                    [
                        normalize_text(current.get("usuario")),
                        normalize_text(current.get("usuario_email")),
                        normalize_text(current.get("garaje")),
                        normalize_text(current.get("garage_id")),
                    ]
                )
                if normalized_search not in haystack:
                    continue

            ultimo_pago = current.get("ultimo_pago") or None
            rows.append(
                {
                    **current,
                    "deuda_total": round(float(current.get("deuda_total") or 0), 2),
                    "amount": round(float(current.get("deuda_total") or 0), 2),
                    "user_name": current.get("usuario"),
                    "user_email": current.get("usuario_email"),
                    "days_overdue": dias_vencidos,
                    "ultimo_pago": ultimo_pago,
                    "last_payment": ultimo_pago,
                    "ultimo_pago_fecha": (ultimo_pago or {}).get("fecha"),
                    "ultimo_pago_monto": (ultimo_pago or {}).get("monto", 0),
                    "ultimo_pago_referencia": (ultimo_pago or {}).get("referencia", ""),
                    "ultimo_pago_metodo": (ultimo_pago or {}).get("metodo", ""),
                }
            )

        rows.sort(
            key=lambda row: (
                -int(row.get("dias_vencidos") or 0),
                -float(row.get("deuda_total") or 0),
                normalize_text(row.get("usuario")),
            )
        )
        return rows

    def overdue_user_stats(
        self,
        *,
        garage_id: str,
        search: str = "",
        min_days: int | None = None,
        max_days: int | None = None,
    ) -> dict[str, Any]:
        rows = self.list_overdue_users(
            garage_id=garage_id,
            search=search,
            min_days=min_days,
            max_days=max_days,
        )
        total_overdue_amount = round(sum(float(row.get("deuda_total") or 0) for row in rows), 2)
        max_days_overdue = max((int(row.get("dias_vencidos") or 0) for row in rows), default=0)
        pending_count = sum(int(row.get("planes_pendientes") or 0) for row in rows)

        return {
            "overdue_count": len(rows),
            "total_overdue_amount": total_overdue_amount,
            "max_days_overdue": max_days_overdue,
            "pending_count": pending_count,
        }

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
