from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone
from io import BytesIO
import re
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from services.email_service import EmailService
from repositories import PaymentRepository, SessionRepository, UserRepository, VehicleRepository
from utils.supabase_client import parse_datetime, select_rows, utcnow


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _first(*values: Any, default: Any = "") -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return default


def _money(value: Any) -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return f"RD$ {amount:,.2f}"


def _date(value: Any) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        parsed = utcnow()
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _invoice_number(payment: dict[str, Any] | None, session_id: str) -> str:
    source = str((payment or {}).get("id") or session_id or "sin-id")
    return f"SP-{source[:8].upper()}"


def _valid_email(value: Any) -> str:
    email = str(value or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return ""
    return email


@dataclass(frozen=True)
class InvoicePayload:
    session: dict[str, Any]
    payment: dict[str, Any] | None
    user: dict[str, Any] | None
    vehicle: dict[str, Any] | None
    garage: dict[str, Any] | None


class InvoiceService:
    def __init__(self) -> None:
        self.payment_repository = PaymentRepository()
        self.session_repository = SessionRepository()
        self.user_repository = UserRepository()
        self.vehicle_repository = VehicleRepository()
        self.email_service = EmailService()

    def _get_payment(self, *, payment_id: str | None = None, session_id: str | None = None) -> dict[str, Any] | None:
        if payment_id:
            return self.payment_repository.get_by_id(payment_id)
        if session_id:
            payments = self.payment_repository.get_by_session(session_id)
            return payments[0] if payments else None
        return None

    def _get_garage(self, garage_id: str | None) -> dict[str, Any] | None:
        if not garage_id:
            return None
        for table_name in ("garages", "settings"):
            rows = select_rows(
                table_name,
                filters=[{"column": "garage_id", "value": garage_id, "optional": True}],
                order_candidates=["updated_at", "created_at", "name", "nombre"],
                desc=True,
                limit=1,
            )
            if rows:
                return rows[0]
        return None

    def _build_payload(self, *, payment_id: str | None = None, session_id: str | None = None) -> InvoicePayload | None:
        payment = self._get_payment(payment_id=payment_id, session_id=session_id)
        resolved_session_id = session_id or str((payment or {}).get("session_id") or "")
        if not resolved_session_id:
            return None

        session = self.session_repository.get_by_id(resolved_session_id)
        if not session:
            return None

        vehicle_id = str(session.get("vehicle_id") or session.get("vehiculo_id") or "")
        vehicle = self.vehicle_repository.get_by_id(vehicle_id) if vehicle_id else None
        user_id = str(
            _first(
                payment.get("user_id") if payment else None,
                payment.get("usuario_id") if payment else None,
                session.get("user_id"),
                session.get("usuario_id"),
                (vehicle or {}).get("user_id"),
            )
        )
        user = self.user_repository.get_by_id(user_id) if user_id else None
        garage_id = str(_first(session.get("garage_id"), (vehicle or {}).get("garage_id"), (user or {}).get("garage_id")))

        return InvoicePayload(
            session=session,
            payment=payment,
            user=user,
            vehicle=vehicle,
            garage=self._get_garage(garage_id),
        )

    def generate_invoice_pdf(self, *, payment_id: str | None = None, session_id: str | None = None) -> bytes | None:
        payload = self._build_payload(payment_id=payment_id, session_id=session_id)
        if payload is None:
            return None

        session = payload.session
        payment = payload.payment or {}
        vehicle = payload.vehicle or {}
        user = payload.user or {}
        garage = payload.garage or {}

        amount = _first(payment.get("amount"), payment.get("monto"), session.get("amount"), session.get("total_amount"), default=0)
        invoice_no = _invoice_number(payment, str(session.get("id") or session_id or ""))
        garage_name = _first(garage.get("company_name"), garage.get("nombre_empresa"), garage.get("name"), garage.get("nombre"), session.get("garage_id"), default="SmartPark")
        user_name = _first(user.get("name"), user.get("nombre"), session.get("owner_name"), vehicle.get("owner_name"), default="Cliente")
        user_email = _first(
            user.get("email"),
            payment.get("email"),
            payment.get("customer_email"),
            payment.get("user_email"),
            vehicle.get("owner_email"),
            default="N/D",
        )
        concept = _first(payment.get("concepto"), payment.get("description"), default="Servicio de parqueo")
        transaction = _first(payment.get("payment_reference"), payment.get("referencia"), payment.get("id"), default="N/D")

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.65 * inch,
            bottomMargin=0.65 * inch,
        )
        styles = getSampleStyleSheet()
        story = [
            Paragraph("SmartPark", styles["Title"]),
            Paragraph(f"Factura #{invoice_no}", styles["Heading2"]),
            Spacer(1, 0.2 * inch),
        ]

        summary_table = Table(
            [
                ["Fecha", _date(_first(payment.get("fecha"), payment.get("paid_at"), payment.get("created_at"), session.get("paid_at")))],
                ["Usuario", f"{user_name} ({user_email})"],
                ["Garage", str(garage_name)],
                ["Concepto", str(concept)],
                ["Monto", _money(amount)],
                ["Transaccion", str(transaction)],
            ],
            colWidths=[1.6 * inch, 4.6 * inch],
        )
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0F172A")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.extend([summary_table, Spacer(1, 0.3 * inch)])

        details_table = Table(
            [
                ["Sesion", str(session.get("id") or "N/D")],
                ["Vehiculo", _first(vehicle.get("plate"), session.get("plate"), default="N/D")],
                ["Metodo", _first(payment.get("payment_method"), payment.get("metodo"), default="N/D")],
                ["Estado", _first(payment.get("status"), payment.get("estado"), session.get("payment_status"), default="pagado")],
            ],
            colWidths=[1.6 * inch, 4.6 * inch],
        )
        details_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.extend([Paragraph("Detalles", styles["Heading3"]), details_table, Spacer(1, 0.35 * inch)])
        story.append(Paragraph("Gracias por utilizar SmartPark.", styles["Normal"]))

        doc.build(story)
        return buffer.getvalue()

    def get_recipient_email(self, *, payment_id: str | None = None, session_id: str | None = None) -> str:
        payload = self._build_payload(payment_id=payment_id, session_id=session_id)
        if payload is None:
            return ""

        payment = payload.payment or {}
        user = payload.user or {}
        vehicle = payload.vehicle or {}

        for candidate in (
            user.get("email"),
            payment.get("email"),
            payment.get("customer_email"),
            payment.get("user_email"),
            payment.get("payer_email"),
            vehicle.get("owner_email"),
        ):
            email = _valid_email(candidate)
            if email:
                return email
        return ""

    def send_invoice_email(self, *, payment_id: str | None = None, session_id: str | None = None) -> dict[str, Any]:
        recipient = self.get_recipient_email(payment_id=payment_id, session_id=session_id)
        if not recipient:
            return {
                "success": False,
                "sent": False,
                "reason": "invalid_or_missing_recipient_email",
            }

        pdf_bytes = self.generate_invoice_pdf(payment_id=payment_id, session_id=session_id)
        if not pdf_bytes:
            return {
                "success": False,
                "sent": False,
                "reason": "invoice_not_found",
                "to": recipient,
            }

        filename_id = payment_id or session_id or "factura"
        return self.email_service.send_email(
            to_email=recipient,
            subject="Factura SmartPark",
            body="Adjuntamos tu factura de SmartPark.",
            attachments=[(f"factura-{filename_id}.pdf", pdf_bytes)],
        )
