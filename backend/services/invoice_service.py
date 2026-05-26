from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone
from io import BytesIO
import re
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

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


def _display_datetime(value: Any) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        parsed = utcnow()
    return parsed.astimezone(timezone.utc).strftime("%d/%m/%Y, %I:%M %p").replace("AM", "a. m.").replace("PM", "p. m.")


def _duration_minutes(session: dict[str, Any]) -> int:
    raw = _first(session.get("duration_minutes"), session.get("duracion"), default=0)
    try:
        minutes = int(float(raw or 0))
    except (TypeError, ValueError):
        minutes = 0
    if minutes > 0:
        return minutes

    entry = parse_datetime(_first(session.get("entry_time"), session.get("entrada"), session.get("hora_entrada")))
    exit_time = parse_datetime(_first(session.get("exit_time"), session.get("salida"), session.get("hora_salida")))
    if entry and exit_time:
        return max(1, int(round((exit_time - entry).total_seconds() / 60)))
    return 1


def _duration_label(minutes: int) -> str:
    minutes = max(1, int(minutes or 1))
    hours, mins = divmod(minutes, 60)
    if hours and mins:
        return f"{hours} h {mins} min"
    if hours:
        return f"{hours} h"
    return f"{mins} min"


def _invoice_number(payment: dict[str, Any] | None, session_id: str) -> str:
    source = str((payment or {}).get("id") or session_id or "sin-id")
    compact = re.sub(r"[^A-Za-z0-9]", "", source).upper()
    return f"FAC-{compact[:13].ljust(13, '0')}"


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
        concept = _first(payment.get("concepto"), payment.get("description"), default="Estacionamiento")
        transaction = _first(payment.get("payment_reference"), payment.get("referencia"), payment.get("id"), default="N/D")
        plate = _first(vehicle.get("plate"), vehicle.get("placa"), session.get("plate"), session.get("placa"), default="N/D")
        model = _first(vehicle.get("model"), vehicle.get("modelo"), session.get("model"), session.get("modelo"), default="N/D")
        vehicle_label = f"{plate} - {model}" if model != "N/D" else str(plate)

        entry_value = _first(session.get("entry_time"), session.get("entrada"), session.get("hora_entrada"))
        exit_value = _first(session.get("exit_time"), session.get("salida"), session.get("hora_salida"), payment.get("fecha"), payment.get("created_at"))
        entry_label = _display_datetime(entry_value)
        exit_label = _display_datetime(exit_value)
        minutes = _duration_minutes(session)
        billed_hours = max(1, int((minutes + 59) // 60))
        quantity_label = f"{minutes / 60:.2f} h"
        amount_float = float(amount or 0)
        unit_price = amount_float / billed_hours if billed_hours else amount_float
        subtotal = amount_float
        itbis = 0.0
        total = subtotal + itbis
        space_label = _first(session.get("space_code"), session.get("espacio"), session.get("space_id"), session.get("espacio_id"), default="N/D")
        issued_at = _display_datetime(_first(payment.get("fecha"), payment.get("paid_at"), payment.get("created_at"), session.get("paid_at"), exit_value))

        buffer = BytesIO()
        page_width, page_height = letter
        pdf = canvas.Canvas(buffer, pagesize=letter)

        navy = colors.HexColor("#0F172A")
        navy_2 = colors.HexColor("#1E3A5F")
        sky = colors.HexColor("#22B8F0")
        sky_dark = colors.HexColor("#0EA5E9")
        pale = colors.HexColor("#F8FAFC")
        line = colors.HexColor("#DCE6F2")
        muted = colors.HexColor("#64748B")
        soft = colors.HexColor("#94A3B8")

        def text(x: float, y: float, value: Any, *, size: int = 10, color=navy, font: str = "Helvetica") -> None:
            pdf.setFillColor(color)
            pdf.setFont(font, size)
            pdf.drawString(x, y, str(value))

        def right_text(x: float, y: float, value: Any, *, size: int = 10, color=navy, font: str = "Helvetica") -> None:
            pdf.setFillColor(color)
            pdf.setFont(font, size)
            pdf.drawRightString(x, y, str(value))

        def center_text(x: float, y: float, value: Any, *, size: int = 10, color=navy, font: str = "Helvetica") -> None:
            pdf.setFillColor(color)
            pdf.setFont(font, size)
            pdf.drawCentredString(x, y, str(value))

        def card(x: float, y: float, w: float, h: float) -> None:
            pdf.setFillColor(pale)
            pdf.setStrokeColor(line)
            pdf.setLineWidth(1)
            pdf.roundRect(x, y, w, h, 9, fill=1, stroke=1)

        margin = 0.43 * inch
        content_w = page_width - (margin * 2)
        inner_x = margin + 38
        inner_w = content_w - 76
        right_edge = margin + content_w - 38

        text(margin, page_height - 22, issued_at.split(",")[0], size=8)
        center_text(page_width / 2, page_height - 22, f"Factura {invoice_no} - SmartPark", size=8)

        header_y = page_height - 126
        pdf.setFillColor(navy_2)
        pdf.rect(margin, header_y, content_w, 116, fill=1, stroke=0)
        pdf.setFillColor(sky)
        logo_x = inner_x
        logo_y = header_y + 40
        pdf.roundRect(logo_x, logo_y, 44, 44, 9, fill=1, stroke=0)
        center_text(logo_x + 22, logo_y + 14, "P", size=18, color=navy, font="Helvetica-Bold")
        text(logo_x + 60, header_y + 61, "SmartPark", size=21, color=colors.white, font="Helvetica-Bold")
        text(logo_x + 60, header_y + 42, "CONTROL TOTAL - ESTACIONAMIENTO", size=8, color=colors.HexColor("#BAE6FD"), font="Helvetica")

        pdf.setStrokeColor(colors.HexColor("#38BDF8"))
        pdf.setFillColor(colors.HexColor("#1F5E83"))
        badge_w = 122
        badge_x = right_edge - badge_w
        pdf.roundRect(badge_x, header_y + 75, badge_w, 22, 11, fill=1, stroke=1)
        center_text(badge_x + badge_w / 2, header_y + 82, "FACTURA OFICIAL", size=8, color=colors.HexColor("#BAE6FD"), font="Helvetica-Bold")
        right_text(right_edge, header_y + 53, invoice_no, size=19, color=colors.white, font="Helvetica-Bold")
        right_text(right_edge, header_y + 34, f"Emitida: {issued_at}", size=9, color=colors.HexColor("#CBD5E1"))

        pdf.setFillColor(sky_dark)
        pdf.rect(margin, header_y - 34, content_w, 34, fill=1, stroke=0)
        center_text(page_width / 2, header_y - 22, "SERVICIO DE ESTACIONAMIENTO - PAGO PROCESADO", size=9, color=colors.white, font="Helvetica-Bold")

        section_y = header_y - 74
        text(inner_x, section_y, "INFORMACION DEL CLIENTE", size=8, color=soft, font="Helvetica-Bold")
        pdf.setStrokeColor(line)
        pdf.line(inner_x + 128, section_y + 4, right_edge, section_y + 4)

        client_y = section_y - 78
        gap = 10
        client_card_w = (inner_w - gap) / 2
        card(inner_x, client_y, client_card_w, 60)
        text(inner_x + 16, client_y + 38, "PROPIETARIO", size=7, color=soft, font="Helvetica-Bold")
        text(inner_x + 16, client_y + 20, user_name, size=11, color=navy, font="Helvetica-Bold")

        vehicle_card_x = inner_x + client_card_w + gap
        card(vehicle_card_x, client_y, client_card_w, 60)
        text(vehicle_card_x + 16, client_y + 38, "VEHICULO", size=7, color=soft, font="Helvetica-Bold")
        text(vehicle_card_x + 16, client_y + 22, str(plate), size=11, color=navy, font="Helvetica-Bold")
        text(vehicle_card_x + 16, client_y + 9, str(model), size=8, color=muted)

        detail_title_y = client_y - 38
        text(inner_x, detail_title_y, "DETALLE DEL SERVICIO", size=8, color=soft, font="Helvetica-Bold")
        pdf.line(inner_x + 128, detail_title_y + 4, right_edge, detail_title_y + 4)

        table_x = inner_x
        table_w = inner_w
        header_h = 46
        row_h = 60
        table_top = detail_title_y - 16
        header_y2 = table_top - header_h
        row_y = header_y2 - row_h
        pdf.setFillColor(navy)
        pdf.roundRect(table_x, header_y2, table_w, header_h, 7, fill=1, stroke=0)
        desc_x = table_x + 16
        qty_x = table_x + 268
        unit_x = table_x + 360
        total_x = table_x + table_w - 18
        text(desc_x, header_y2 + 21, "DESCRIPCION", size=8, color=soft, font="Helvetica-Bold")
        center_text(qty_x + 26, header_y2 + 21, "CANTIDAD", size=8, color=soft, font="Helvetica-Bold")
        center_text(unit_x + 26, header_y2 + 26, "PRECIO", size=8, color=soft, font="Helvetica-Bold")
        center_text(unit_x + 26, header_y2 + 14, "UNITARIO", size=8, color=soft, font="Helvetica-Bold")
        right_text(total_x, header_y2 + 21, "TOTAL", size=8, color=soft, font="Helvetica-Bold")

        service_name = f"{concept} - Espacio {space_label}"
        pdf.setFillColor(colors.white)
        pdf.rect(table_x, row_y, table_w, row_h, fill=1, stroke=0)
        pdf.setStrokeColor(colors.HexColor("#EEF2F7"))
        pdf.line(table_x, row_y, table_x + table_w, row_y)
        text(desc_x, row_y + 38, service_name, size=9, color=navy, font="Helvetica-Bold")
        text(desc_x, row_y + 24, f"Entrada: {entry_label} - Salida:", size=7, color=muted)
        text(desc_x, row_y + 12, exit_label, size=7, color=muted)
        center_text(qty_x + 26, row_y + 24, quantity_label, size=9, color=navy)
        center_text(unit_x + 26, row_y + 24, f"{_money(unit_price)}/hr", size=9, color=navy)
        right_text(total_x, row_y + 24, _money(total), size=10, color=navy, font="Helvetica-Bold")

        time_title_y = row_y - 34
        text(inner_x, time_title_y, "RESUMEN DE TIEMPO", size=8, color=soft, font="Helvetica-Bold")
        pdf.line(inner_x + 118, time_title_y + 4, right_edge, time_title_y + 4)

        time_y = time_title_y - 60
        time_cards = [
            ("ENTRADA", entry_label),
            ("SALIDA", exit_label),
            ("DURACION", _duration_label(minutes)),
            ("ESPACIO", space_label),
        ]
        card_w = (inner_w - 18) / 4
        for index, (label, value) in enumerate(time_cards):
            x = inner_x + index * (card_w + 6)
            card(x, time_y, card_w, 50)
            center_text(x + card_w / 2, time_y + 31, label, size=6, color=soft, font="Helvetica-Bold")
            center_text(x + card_w / 2, time_y + 15, value, size=7, color=navy, font="Helvetica-Bold")

        totals_w = 262
        totals_x = right_edge - totals_w
        totals_y = time_y - 116
        text(totals_x, totals_y + 78, "Subtotal", size=9, color=muted)
        right_text(right_edge, totals_y + 78, _money(subtotal), size=9, color=navy, font="Helvetica-Bold")
        pdf.setStrokeColor(colors.HexColor("#E5EAF2"))
        pdf.line(totals_x, totals_y + 64, right_edge, totals_y + 64)
        text(totals_x, totals_y + 50, "ITBIS", size=9, color=muted)
        right_text(right_edge, totals_y + 50, _money(itbis), size=9, color=navy, font="Helvetica-Bold")
        pdf.line(totals_x, totals_y + 36, right_edge, totals_y + 36)

        pdf.setFillColor(navy_2)
        pdf.roundRect(totals_x, totals_y - 22, totals_w, 54, 9, fill=1, stroke=0)
        text(totals_x + 18, totals_y - 2, "TOTAL PAGADO", size=9, color=colors.HexColor("#7DD3FC"), font="Helvetica-Bold")
        right_text(right_edge - 18, totals_y - 6, _money(total), size=22, color=colors.white, font="Helvetica-Bold")

        text(margin - 4, 20, "about:blank", size=7, color=colors.black)
        right_text(page_width - margin + 4, 20, "1/1", size=7, color=colors.black)
        pdf.showPage()
        pdf.save()
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

