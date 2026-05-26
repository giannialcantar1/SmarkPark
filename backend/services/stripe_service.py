from __future__ import annotations

import json
from math import ceil
from typing import Any

from config import Config
from services.parking_service import ParkingService
from utils.supabase_client import insert_row, normalize_text, select_rows, update_rows, utcnow_iso

try:
    import stripe
except ImportError:  # pragma: no cover - keeps the app importable until requirements are installed.
    stripe = None


class StripeConfigurationError(RuntimeError):
    pass


class StripePaymentService:
    def __init__(self) -> None:
        self.parking_service = ParkingService()

    def _client(self):
        if stripe is None:
            raise StripeConfigurationError("Instala las dependencias con pip install -r backend/requirements.txt")
        if not Config.STRIPE_SECRET_KEY:
            raise StripeConfigurationError("Configura STRIPE_SECRET_KEY en backend/.env")
        stripe.api_key = Config.STRIPE_SECRET_KEY
        return stripe

    def _to_unit_amount(self, amount: float) -> int:
        return max(1, int(ceil(float(amount) * Config.STRIPE_AMOUNT_MULTIPLIER)))

    def _success_url(self, page: str) -> str:
        return f"{Config.FRONTEND_BASE_URL}/{page}?stripe=success&checkout_session_id={{CHECKOUT_SESSION_ID}}"

    def _cancel_url(self, page: str) -> str:
        return f"{Config.FRONTEND_BASE_URL}/{page}?stripe=cancel"

    def create_parking_checkout_session(
        self,
        *,
        garage_id: str,
        user_id: str,
        placa: str,
        amount: float,
    ) -> dict[str, Any]:
        if amount <= 0:
            raise ValueError("El monto debe ser mayor que cero")
        normalized_plate = str(placa or "").strip().upper()
        if not normalized_plate:
            raise ValueError("La placa es requerida")

        active_session = self._active_parking_session(garage_id=garage_id, placa=normalized_plate)
        if not active_session:
            raise ValueError("No existe una sesion activa para esa placa")

        client = self._client()
        checkout = client.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": Config.STRIPE_CURRENCY,
                        "product_data": {"name": f"Pago de parqueo {normalized_plate}"},
                        "unit_amount": self._to_unit_amount(amount),
                    },
                    "quantity": 1,
                }
            ],
            success_url=self._success_url("payments"),
            cancel_url=self._cancel_url("payments"),
            metadata={
                "smartpark_type": "parking_exit",
                "garage_id": garage_id,
                "user_id": user_id,
                "placa": normalized_plate,
                "session_id": str(active_session.get("id") or ""),
                "amount": f"{float(amount):.2f}",
            },
        )
        return {"id": checkout.id, "url": checkout.url}

    def _active_parking_session(self, *, garage_id: str, placa: str) -> dict[str, Any] | None:
        normalized_plate = normalize_text(placa)
        return next(
            (
                row
                for row in self.parking_service._sessions(garage_id=garage_id)
                if normalize_text(row.get("plate") or row.get("placa")) == normalized_plate
                and not row.get("exit_time")
                and not row.get("salida")
            ),
            None,
        )

    def create_monthly_plan_checkout_session(
        self,
        *,
        garage_id: str,
        user_id: str,
        plan_id: str,
        amount: float,
    ) -> dict[str, Any]:
        if amount <= 0:
            raise ValueError("El monto debe ser mayor que cero")
        if not plan_id:
            raise ValueError("plan_id es requerido")

        client = self._client()
        checkout = client.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": Config.STRIPE_CURRENCY,
                        "product_data": {"name": "Plan mensual SmartPark"},
                        "unit_amount": self._to_unit_amount(amount),
                    },
                    "quantity": 1,
                }
            ],
            success_url=self._success_url("monthly-plans"),
            cancel_url=self._cancel_url("monthly-plans"),
            metadata={
                "smartpark_type": "monthly_plan",
                "garage_id": garage_id,
                "user_id": user_id,
                "plan_id": plan_id,
                "amount": f"{float(amount):.2f}",
            },
        )
        return {"id": checkout.id, "url": checkout.url}

    def construct_webhook_event(self, payload: bytes, signature: str | None) -> Any:
        client = self._client()
        if Config.STRIPE_WEBHOOK_SECRET:
            return client.Webhook.construct_event(payload, signature, Config.STRIPE_WEBHOOK_SECRET)
        return client.Event.construct_from(json.loads(payload.decode("utf-8")), client.api_key)

    def finalize_checkout_session(self, checkout_session_id: str) -> dict[str, Any]:
        checkout_session_id = str(checkout_session_id or "").strip()
        if not checkout_session_id:
            raise ValueError("checkout_session_id es requerido")

        client = self._client()
        checkout = client.checkout.Session.retrieve(checkout_session_id)
        if checkout.payment_status != "paid":
            return {"status": "pending", "checkout_session_id": checkout_session_id}

        metadata = dict(checkout.metadata or {})
        payment_type = metadata.get("smartpark_type")
        if payment_type == "parking_exit":
            return self._finalize_parking_exit(checkout_session_id, metadata)
        if payment_type == "monthly_plan":
            return self._finalize_monthly_plan(checkout_session_id, metadata)
        return {"status": "ignored", "checkout_session_id": checkout_session_id}

    def _finalize_parking_exit(self, checkout_session_id: str, metadata: dict[str, str]) -> dict[str, Any]:
        garage_id = metadata.get("garage_id", "")
        placa = metadata.get("placa", "")
        session_id = str(metadata.get("session_id") or "").strip()
        amount = round(float(metadata.get("amount") or 0), 2)

        if session_id:
            existing = select_rows(
                "payments",
                filters=[{"column": "session_id", "value": session_id, "optional": False}],
                limit=1,
            )
            if existing:
                return {"status": "paid", "type": "parking_exit", "payment": existing[0]}

        try:
            result = self.parking_service.register_exit(
                garage_id=garage_id,
                placa=placa,
                payment_method="stripe",
                payment_reference=checkout_session_id,
            )
        except ValueError:
            if session_id:
                existing = select_rows(
                    "payments",
                    filters=[{"column": "session_id", "value": session_id, "optional": False}],
                    limit=1,
                )
                if existing:
                    return {"status": "paid", "type": "parking_exit", "payment": existing[0]}
            raise
        payment = result.get("payment") or {}
        if payment.get("id") and amount > 0:
            updated = update_rows(
                "payments",
                payload={
                    "monto": amount,
                    "metodo": "stripe",
                    "estado": "pagado",
                },
                filters=[{"column": "id", "value": payment.get("id"), "optional": False}],
            )
            payment = updated[0] if updated else payment
        return {"status": "paid", "type": "parking_exit", "payment": payment, "session": result.get("session")}

    def _finalize_monthly_plan(self, checkout_session_id: str, metadata: dict[str, str]) -> dict[str, Any]:
        garage_id = metadata.get("garage_id", "")
        plan_id = metadata.get("plan_id", "")
        user_id = metadata.get("user_id", "")
        amount = round(float(metadata.get("amount") or 0), 2)

        existing = select_rows(
            "monthly_plan_payments",
            filters=[{"column": "reference", "value": checkout_session_id, "optional": False}],
            limit=1,
        )
        if existing:
            return {"status": "paid", "type": "monthly_plan", "ledger": existing[0]}

        plans = select_rows(
            "monthly_plans",
            filters=[
                {"column": "id", "value": plan_id, "optional": False},
                {"column": "garage_id", "value": garage_id, "optional": True},
            ],
            limit=1,
        )
        if not plans:
            raise ValueError("Plan mensual no encontrado")

        plan = plans[0]
        plan_user_id = str(plan.get("user_id") or user_id or "").strip()
        now = utcnow_iso()
        update_rows(
            "monthly_plans",
            payload={"status": "pagado"},
            filters=[{"column": "id", "value": plan_id, "optional": False}],
        )
        payment_row = insert_row(
            "payments",
            {
                "garage_id": garage_id,
                "user_id": plan_user_id or None,
                "monto": amount,
                "metodo": "stripe",
                "estado": "pagado",
                "fecha": now,
                "created_at": now,
            },
        )
        ledger_row = insert_row(
            "monthly_plan_payments",
            {
                "garage_id": garage_id,
                "plan_id": plan_id,
                "user_id": plan_user_id,
                "amount": amount,
                "method": "stripe",
                "reference": checkout_session_id,
                "status": "approved",
                "paid_at": now,
                "created_at": now,
            },
        )
        return {"status": "paid", "type": "monthly_plan", "payment": payment_row, "ledger": ledger_row}
