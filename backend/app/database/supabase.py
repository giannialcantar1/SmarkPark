"""Supabase connection management module."""

from supabase import Client, create_client

from app.config.settings import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SupabaseClientManager:
    """Single-responsibility class to initialize and expose Supabase client."""

    def __init__(self) -> None:
        self._client: Client | None = None

    def connect(self) -> Client:
        """Create Supabase client lazily using environment-based settings."""
        if self._client is not None:
            return self._client

        settings = get_settings()
        self._client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info('Supabase client initialized successfully.')
        return self._client

    def get_client(self) -> Client:
        """Return active client instance, creating it if needed."""
        return self.connect()


supabase_manager = SupabaseClientManager()


def get_supabase_client() -> Client:
    """Dependency-ready function for future route/service injection."""
    return supabase_manager.get_client()
