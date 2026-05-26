from __future__ import annotations

import base64

from flask import Blueprint, current_app, g, jsonify, request

from controllers import PaymentController
from services import InvoiceService
from services.stripe_service import StripeConfigurationError, StripePaymentService
from utils.decorators import auth_required
from utils.supabase_client import insert_row, normalize_session, select_rows, update_rows, utcnow_iso


payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")
controller = PaymentController()
stripe_payments = StripePaymentService()
invoice_service = InvoiceService()


def _garage_sessions() -> list[dict]:
    rows = select_rows(
        "parking_sessions",
        filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": True}],
        order_candidates=["entrada", "entry_time", "created_at"],
        desc=True,
    )

    vehicles = {
        str(row.get("id")): row
        for row in select_rows(
            "vehicles",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["created_at"],
            desc=True,
        )
    }
    spaces = {
        str(row.get("id")): row
        for row in select_rows(
            "parking_spaces",
            filters=[{"column": "garage_id", "value": g.current_user_garage_id, "optional": False}],
            order_candidates=["numero", "piso"],
        )
    }

    sessions: list[dict] = []
    for row in rows:
        normalized = normalize_session(row)
        vehicle = vehicles.get(str(normalized.get("vehicle_id")))
        space = spaces.get(str(normalized.get("space_id")))
        if normalized.get("garage_id") == g.current_user_garage_id or vehicle or space:
            sessions.append(normalized)
    return sessions


@payments_bp.post("")
@auth_required
def create_payment():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id") or "").strip()
    payment_method = str(payload.get("payment_method") or payload.get("metodo") or "").strip()

    try:
        amount = float(payload.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "amount debe ser numerico"}), 400

    if not session_id or not payment_method:
        return jsonify({"success": False, "error": "session_id y payment_method son requeridos"}), 400

    session = next((row for row in _garage_sessions() if str(row.get("id")) == session_id), None)
    if not session:
        return jsonify({"success": False, "error": "Sesion no encontrada"}), 404

    payment = insert_row(
        "payments",
        {
            "session_id": session_id,
            "monto": round(amount, 2),
            "amount": round(amount, 2),
            "metodo": payment_method,
            "payment_method": payment_method,
            "estado": "pagado",
            "status": "paid",
            "fecha": utcnow_iso(),
            "paid_at": utcnow_iso(),
            "created_at": utcnow_iso(),
        },
    )

    update_rows(
        "parking_sessions",
        payload={
            "payment_status": "paid",
            "paid": True,
            "paid_at": utcnow_iso(),
        },
        filters=[
            {"column": "id", "value": session_id, "optional": False},
            {"column": "garage_id", "value": g.current_user_garage_id, "optional": True},
        ],
    )

    return jsonify({"success": True, "message": "Pago registrado", "data": payment}), 201


@payments_bp.get("")
@auth_required
def list_payments():
    return controller.list()


@payments_bp.get("/receipt/<session_id>")
@auth_required
def payment_receipt(session_id: str):
    return controller.get_receipt(session_id)


@payments_bp.post("/stripe/checkout-session")
@auth_required
def create_stripe_parking_checkout_session():
    payload = request.get_json(silent=True) or {}
    placa = str(payload.get("placa") or payload.get("plate") or "").strip().upper()
    try:
        amount = round(float(payload.get("amount") or payload.get("total") or 0), 2)
    except (TypeError, ValueError):
        current_app.logger.warning("Stripe checkout parking 400: amount invalido payload=%s", {"placa": placa, "amount": payload.get("amount"), "total": payload.get("total")})
        return jsonify({"success": False, "error": "amount debe ser numerico"}), 400

    try:
        checkout = stripe_payments.create_parking_checkout_session(
            garage_id=g.current_user_garage_id,
            user_id=g.current_user_id,
            placa=placa,
            amount=amount,
        )
    except StripeConfigurationError as exc:
        current_app.logger.warning("Stripe checkout parking config error: %s", str(exc))
        return jsonify({"success": False, "error": str(exc)}), 503
    except ValueError as exc:
        current_app.logger.warning(
            "Stripe checkout parking 400: %s payload=%s",
            str(exc),
            {"placa": placa, "amount": amount, "garage_id": g.current_user_garage_id, "user_id": g.current_user_id},
        )
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        current_app.logger.exception("Stripe checkout parking error payload=%s", {"placa": placa, "amount": amount, "garage_id": g.current_user_garage_id})
        return jsonify({"success": False, "error": str(exc) or "No se pudo crear el checkout de Stripe"}), 500

    return jsonify({"success": True, "data": checkout})


@payments_bp.post("/stripe/confirm")
@auth_required
def confirm_stripe_checkout_session():
    payload = request.get_json(silent=True) or {}
    checkout_session_id = str(payload.get("checkout_session_id") or payload.get("session_id") or "").strip()
    try:
        result = stripe_payments.finalize_checkout_session(checkout_session_id)
    except StripeConfigurationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 503
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc) or "No se pudo confirmar el pago de Stripe"}), 500

    if result.get("status") == "paid" and result.get("type") == "parking_exit":
        session_id = str(
            (result.get("session") or {}).get("id")
            or (result.get("payment") or {}).get("session_id")
            or ""
        ).strip()
        if session_id:
            pdf_bytes = invoice_service.generate_invoice_pdf(session_id=session_id)
            if pdf_bytes:
                result["invoice"] = {
                    "filename": f"factura-{session_id}.pdf",
                    "mime_type": "application/pdf",
                    "pdf_base64": base64.b64encode(pdf_bytes).decode("ascii"),
                    "download_url": f"/api/payments/receipt/{session_id}",
                }

    return jsonify({"success": True, "data": result})


@payments_bp.post("/stripe/webhook")
def stripe_webhook():
    payload = request.get_data()
    signature = request.headers.get("Stripe-Signature")
    try:
        event = stripe_payments.construct_webhook_event(payload, signature)
    except StripeConfigurationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc) or "Webhook invalido"}), 400

    if event.get("type") == "checkout.session.completed":
        checkout = event["data"]["object"]
        try:
            stripe_payments.finalize_checkout_session(checkout.get("id"))
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc) or "No se pudo finalizar el pago"}), 500

    return jsonify({"success": True})
