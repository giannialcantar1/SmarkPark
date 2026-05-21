from __future__ import annotations

from services.email_service import EmailService
from utils.supabase_client import insert_row, utcnow_iso


class NotificationService:
    def __init__(self) -> None:
        self.email_service = EmailService()

    def send_email(self, *, to_email: str, subject: str, message: str) -> dict:
        result = self.email_service.send_email(
            to_email=to_email,
            subject=subject,
            body=message,
        )
        return {
            **result,
            "message": message,
            "provider": "smtp" if result.get("sent") else "smtp_unavailable",
        }

    def create_notification(
        self,
        *,
        usuario_id: str,
        mensaje: str,
        tipo: str,
        leida: bool = False,
    ) -> dict:
        return insert_row(
            "notifications",
            {
                "usuario_id": usuario_id,
                "mensaje": mensaje,
                "tipo": tipo,
                "leida": leida,
                "fecha": utcnow_iso(),
                "created_at": utcnow_iso(),
            },
        )
