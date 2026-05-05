from __future__ import annotations

from flask import g, jsonify, request

from services import PaymentService


class PaymentController:
    def __init__(self) -> None:
        self.payment_service = PaymentService()

    def process(self):
        payload = request.get_json(silent=True) or {}
        session_id = str(payload.get("session_id") or "").strip()
        metodo = str(payload.get("payment_method") or payload.get("metodo") or "").strip()

        try:
            monto = float(payload.get("amount") if payload.get("amount") is not None else payload.get("monto"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "amount debe ser numerico"}), 400

        if not session_id or not metodo:
            return jsonify({"success": False, "error": "session_id y payment_method son requeridos"}), 400

        if not self.payment_service.session_belongs_to_garage(garage_id=g.current_user_garage_id, session_id=session_id):
            return jsonify({"success": False, "error": "Sesion no encontrada"}), 404

        payment = self.payment_service.process_payment(session_id=session_id, monto=monto, metodo=metodo)
        return jsonify({"success": True, "message": "Pago registrado", "data": payment}), 201

    def list(self):
        rows = self.payment_service.list_payments(garage_id=g.current_user_garage_id)
        return jsonify({"success": True, "data": rows})

    def get_receipt(self, session_id: str):
        if not self.payment_service.session_belongs_to_garage(garage_id=g.current_user_garage_id, session_id=session_id):
            return jsonify({"success": False, "error": "Sesion no encontrada"}), 404

        invoice = self.payment_service.get_invoice(session_id=session_id)
        if not invoice:
            return jsonify({"success": False, "error": "Recibo no encontrado"}), 404
        return jsonify({"success": True, "data": invoice})
