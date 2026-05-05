"""Tenant utility placeholders.

Phase 1 intentionally avoids tenant implementation, but this module reserves
clear extension points for multi-tenant context extraction in future phases.
"""

from app.config.settings import get_settings


class TenantContext:
    """Minimal tenant context contract for future dependency injection."""

    def __init__(self, tenant_id: str | None = None) -> None:
        self.tenant_id = tenant_id


class TenantHeaderResolver:
    """Provides the configured tenant header name without applying business logic."""

    def __init__(self) -> None:
        self._settings = get_settings()

    @property
    def header_name(self) -> str:
        return self._settings.MULTI_TENANT_HEADER
