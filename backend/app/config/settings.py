"""Centralized settings for SmartPark.

Loads values from environment variables and the backend `.env` file.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings following 12-factor app principles."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / '.env'),
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore',
    )

    APP_NAME: str = Field(default='SmartPark API', description='Public API name')
    APP_VERSION: str = Field(default='0.1.0', description='Current API version')
    APP_ENV: Literal['development', 'staging', 'production'] = Field(
        default='development',
        description='Current runtime environment',
    )
    DEBUG: bool = Field(default=True, description='Enable debug mode only for development')

    # Supabase settings (never hardcoded).
    SUPABASE_URL: str = Field(..., description='Supabase project URL')
    SUPABASE_KEY: str = Field(..., description='Supabase key (service role or anon key)')

    # Logging settings.
    LOG_LEVEL: Literal['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] = Field(default='INFO')
    LOG_FORMAT: Literal['text', 'json'] = Field(default='text')

    # Future-ready tenant strategy (Phase 1: configuration only).
    MULTI_TENANT_HEADER: str = Field(
        default='X-Tenant-ID',
        description='Reserved header for tenant resolution in future phases',
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings provider to avoid reloading env on every import."""
    return Settings()
