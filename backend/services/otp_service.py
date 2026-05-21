from __future__ import annotations

import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

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

    def _resolve_verify_url(self, *, email: str) -> str:
        base_url = (Config.FRONTEND_ORIGINS[0] if Config.FRONTEND_ORIGINS else 'http://127.0.0.1:5173').rstrip('/')
        return f'{base_url}/verify-otp?email={quote(email)}'

    def _build_plaintext_body(self, *, email: str, code: str) -> str:
        verify_url = self._resolve_verify_url(email=email)
        support_email = Config.SMTP_FROM_EMAIL or Config.SMTP_USER or 'soporte@smartpark.com'
        return (
            'SmartPark\n'
            '\n'
            'Verifica tu cuenta\n'
            'Para completar el registro de tu garaje usa este codigo:\n'
            f'{code}\n'
            '\n'
            'Este codigo expira en 10 minutos.\n'
            f'Verifica aqui: {verify_url}\n'
            '\n'
            f'Soporte: {support_email}\n'
        )

    def _build_html_body(self, *, email: str, code: str) -> str:
        verify_url = self._resolve_verify_url(email=email)
        support_email = Config.SMTP_FROM_EMAIL or Config.SMTP_USER or 'soporte@smartpark.com'
        return f"""<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifica tu cuenta - SmartPark</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,'Segoe UI',sans-serif;color:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Tu codigo SmartPark es {code}. Expira en 10 minutos.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f172a;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
            <tr>
              <td style="background-color:#111827;border:1px solid #1f2a44;border-radius:28px;overflow:hidden;box-shadow:0 24px 80px rgba(2,8,23,0.45);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:36px 32px 26px;background-color:#131c31;border-bottom:1px solid #1e293b;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="left">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td align="center" valign="middle" style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#16d1ff 0%,#8b5cf6 100%);font-size:30px;line-height:64px;font-weight:900;color:#ffffff;text-align:center;box-shadow:0 16px 30px rgba(22,209,255,0.22);">
                                  S
                                </td>
                                <td style="padding-left:16px;">
                                  <div style="font-size:30px;line-height:1.05;font-weight:900;letter-spacing:0.18em;color:#ffffff;">
                                    SMARTPARK
                                  </div>
                                  <div style="margin-top:8px;font-size:12px;line-height:1.4;letter-spacing:0.18em;color:#9fdcff;text-transform:uppercase;">
                                    Verificacion segura para tu garaje
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px 32px 22px;text-align:center;">
                      <div style="font-size:34px;line-height:1.12;font-weight:900;color:#ffffff;margin:0 0 10px;">
                        Verifica tu cuenta
                      </div>
                      <div style="font-size:17px;line-height:1.6;color:#cbd5e1;margin:0 auto;max-width:500px;">
                        Para completar el registro de tu garaje, usa este codigo de verificacion dentro de SmartPark.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:24px;border:1px solid #1d3350;background-color:#0f172a;padding:28px 20px;box-shadow:inset 0 0 0 1px rgba(22,209,255,0.06);">
                            <div style="font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#7dd3fc;margin-bottom:14px;">
                              Codigo de verificacion
                            </div>
                            <div style="font-family:'Courier New',Consolas,monospace;font-size:48px;line-height:1.1;font-weight:900;letter-spacing:0.22em;color:#16d1ff;text-shadow:0 0 18px rgba(22,209,255,0.18);">
                              {code}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 28px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="background-color:rgba(22,209,255,0.09);border:1px solid rgba(22,209,255,0.22);border-radius:999px;padding:12px 18px;font-size:14px;line-height:1.5;font-weight:700;color:#e2f7ff;">
                            Este codigo expira en 10 minutos
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 32px 30px;">
                      <a href="{verify_url}" style="display:inline-block;padding:15px 30px;border-radius:14px;background:linear-gradient(135deg,#16d1ff 0%,#4f46e5 100%);color:#ffffff;font-size:15px;font-weight:800;line-height:1;text-decoration:none;box-shadow:0 18px 32px rgba(22,209,255,0.22);">
                        Verificar
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 18px;text-align:center;">
                      <div style="font-size:14px;line-height:1.7;color:#94a3b8;">
                        Si estas en otra pantalla, tambien puedes copiar y pegar el codigo manualmente.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 34px;text-align:center;">
                      <div style="font-size:13px;line-height:1.7;color:#64748b;">
                        Si no solicitaste este correo, puedes ignorarlo con tranquilidad.
                        <br>
                        Tu cuenta no sera activada sin este paso.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 32px;background-color:#0b1120;border-top:1px solid #1e293b;text-align:center;">
                      <div style="font-size:13px;line-height:1.7;color:#cbd5e1;font-weight:700;">
                        Soporte SmartPark
                      </div>
                      <div style="font-size:13px;line-height:1.7;color:#94a3b8;">
                        Necesitas ayuda? Escribenos a
                        <a href="mailto:{support_email}" style="color:#16d1ff;text-decoration:none;font-weight:700;"> {support_email}</a>
                      </div>
                      <div style="margin-top:8px;font-size:12px;line-height:1.7;color:#64748b;">
                        (c) 2026 SmartPark. Gestion moderna para garajes y estacionamientos.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    def _send_email(self, *, email: str, code: str):
        msg = MIMEMultipart('alternative')
        from_email = Config.SMTP_FROM_EMAIL
        from_name = Config.SMTP_FROM_NAME or 'SmartPark'

        msg['From'] = f'{from_name} <{from_email}>'
        msg['To'] = email
        msg['Subject'] = 'Verifica tu cuenta - SmartPark'
        msg.attach(MIMEText(self._build_plaintext_body(email=email, code=code), 'plain', 'utf-8'))
        msg.attach(MIMEText(self._build_html_body(email=email, code=code), 'html', 'utf-8'))

        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
            server.starttls()
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.send_message(msg)
