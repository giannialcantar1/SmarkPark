from __future__ import annotations
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config
from utils.supabase_client import get_user_table_client


class OTPService:
    def generate_and_send(self, *, user_id: str, email: str) -> str:
        code = str(random.randint(100000, 999999))
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)

        client = get_user_table_client(use_admin=True)
        client.from_('otp_codes').insert({
            'user_id': user_id,
            'email': email,
            'code': code,
            'code_type': 'registration',
            'is_used': False,
            'attempts': 0,
            'created_at': now.isoformat(),
            'expires_at': expires_at.isoformat(),
        }).execute()

        self._send_email(email=email, code=code)
        return code

    def verify(self, *, email: str, code: str) -> bool:
        client = get_user_table_client(use_admin=True)
        now = datetime.now(timezone.utc)
        response = (
            client.from_('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('code_type', 'registration')
            .eq('is_used', False)
            .gt('expires_at', now.isoformat())
            .order('created_at', desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        record = getattr(response, 'data', None)
        if not record:
            return False

        client.from_('otp_codes').update({
            'is_used': True,
            'used_at': now.isoformat(),
        }).eq('id', record['id']).execute()
        return True

    def _send_email(self, *, email: str, code: str):
        msg = MIMEMultipart()
        msg['From'] = Config.SMTP_FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = 'Tu código de verificación - SmartPark'
        body = f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f172a" style="padding:48px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" bgcolor="#1e293b" style="border-radius:20px;overflow:hidden;border:1px solid #334155;box-shadow:0 25px 50px rgba(0,0,0,0.5);">

<tr><td bgcolor="#6d28d9" style="padding:40px 32px;text-align:center;">
<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
<tr><td bgcolor="#8b5cf6" style="border-radius:16px;padding:14px 20px;text-align:center;">
<span style="font-size:36px;font-weight:900;color:#ffffff;font-family:Georgia,serif;">P</span>
</td></tr></table>
<p style="margin:0 0 8px;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:5px;font-family:Arial,sans-serif;">SMARTPARK</p>
<p style="margin:0;font-size:12px;color:#ddd6fe;letter-spacing:3px;font-family:Arial,sans-serif;">SISTEMA DE GESTIÓN DE ESTACIONAMIENTOS</p>
</td></tr>

<tr><td bgcolor="#1e293b" style="padding:48px 40px;text-align:center;">
<p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9;font-family:Arial,sans-serif;">Verifica tu cuenta</p>
<p style="margin:0 0 36px;font-size:15px;color:#94a3b8;line-height:1.7;font-family:Arial,sans-serif;">
Para completar tu registro, ingresa el siguiente<br>código de verificación de 6 dígitos:
</p>

<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
<tr><td bgcolor="#0f172a" style="border-radius:16px;border:2px solid #4338ca;padding:32px 20px;text-align:center;">
<p style="margin:0 0 16px;font-size:11px;color:#64748b;letter-spacing:4px;font-family:Arial,sans-serif;">CÓDIGO DE VERIFICACIÓN</p>
<p style="margin:0;font-size:56px;font-weight:900;color:#00f5ff;letter-spacing:20px;font-family:'Courier New',Courier,monospace;">{code}</p>
</td></tr></table>

<table cellpadding="0" cellspacing="0" style="margin:0 auto 36px;">
<tr><td bgcolor="#064e3b" style="border-radius:100px;padding:12px 28px;">
<p style="margin:0;font-size:14px;color:#34d399;font-weight:600;font-family:Arial,sans-serif;">⏱ El código expira en 10 minutos</p>
</td></tr></table>

<p style="margin:0;font-size:13px;color:#475569;line-height:1.6;font-family:Arial,sans-serif;border-top:1px solid #334155;padding-top:28px;">
Si no solicitaste este código, puedes ignorar este mensaje.<br>Tu cuenta no ha sido modificada.
</p>
</td></tr>

<tr><td bgcolor="#0f172a" style="padding:24px;text-align:center;border-top:1px solid #1e293b;">
<p style="margin:0;font-size:12px;color:#334155;font-family:Arial,sans-serif;">© 2026 SmartPark · Sistema de Gestión de Estacionamientos</p>
</td></tr>

</table>
</td></tr></table>
</body></html>'''
        msg.attach(MIMEText(body, 'html'))
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
            server.starttls()
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.send_message(msg)
