from __future__ import annotations

import smtplib
from email.message import EmailMessage
from mimetypes import guess_type
import re
from typing import Any

from config import Config


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailService:
    def __init__(self) -> None:
        self.host = Config.SMTP_HOST
        self.port = Config.SMTP_PORT
        self.username = Config.SMTP_USERNAME
        self.password = Config.SMTP_PASSWORD
        self.use_tls = Config.SMTP_USE_TLS
        self.sender = Config.SMTP_SENDER

    def is_configured(self) -> bool:
        return bool(self.host and self.sender)

    @staticmethod
    def is_valid_email(email: str) -> bool:
        return bool(EMAIL_RE.fullmatch(str(email or "").strip()))

    def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        body: str,
        html: str | None = None,
        attachments: list[tuple[str, bytes]] | None = None,
    ) -> dict[str, Any]:
        to_email = str(to_email or "").strip().lower()
        if not self.is_valid_email(to_email):
            return {
                "success": False,
                "sent": False,
                "reason": "invalid_recipient_email",
                "to": to_email,
                "subject": subject,
            }

        if not self.is_configured():
            return {
                "success": False,
                "sent": False,
                "reason": "smtp_not_configured",
                "to": to_email,
                "subject": subject,
            }

        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype="html")
        for filename, content in attachments or []:
            mime_type, _ = guess_type(filename)
            maintype, subtype = (mime_type or "application/octet-stream").split("/", 1)
            message.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)

        try:
            with smtplib.SMTP(self.host, self.port, timeout=20) as server:
                if self.use_tls:
                    server.starttls()
                if self.username:
                    server.login(self.username, self.password)
                server.send_message(message)
            return {"success": True, "sent": True, "to": to_email, "subject": subject}
        except Exception as exc:
            return {
                "success": False,
                "sent": False,
                "reason": str(exc),
                "to": to_email,
                "subject": subject,
            }
