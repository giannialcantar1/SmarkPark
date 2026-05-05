from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env", override=False)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "si"}


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    APP_NAME = os.getenv("APP_NAME", "SmartPark API")
    APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
    DEBUG = _as_bool(os.getenv("DEBUG"), default=True)
    HOST = os.getenv("SMARTPARK_HOST", "127.0.0.1")
    PORT = int(os.getenv("SMARTPARK_PORT", "5000"))
    SECRET_KEY = os.getenv("SECRET_KEY", "smartpark-dev-secret")

    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://witurjrwsiwgouomxqvb.supabase.co")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    DEFAULT_GARAGE_ID = os.getenv(
        "SMARTPARK_DEFAULT_GARAGE_ID",
        "d12e9e15-76fd-4cbb-9895-587a29e0cd0f",
    )
    DEFAULT_ADMIN_EMAIL = os.getenv(
        "SMARTPARK_ADMIN_EMAIL",
        "giannisubervi@gmail.com",
    )
    FRONTEND_ORIGINS = _split_csv(os.getenv("FRONTEND_ORIGINS"))
    DEFAULT_HOURLY_RATE = float(os.getenv("SMARTPARK_DEFAULT_HOURLY_RATE", "50"))
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "60"))
    JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "30"))
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_USER = os.getenv("SMTP_USER", SMTP_USERNAME)
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_SENDER = os.getenv("SMTP_SENDER", DEFAULT_ADMIN_EMAIL)
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_SENDER)
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "SmartPark")
    SMTP_USE_TLS = _as_bool(os.getenv("SMTP_USE_TLS"), default=True)
