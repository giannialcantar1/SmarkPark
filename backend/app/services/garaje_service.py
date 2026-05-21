"""Service layer for garajes multi-tenant operations."""

from typing import Any

from app.supabase_client import get_supabase_client


class GarajeService:
    """Encapsulates all access to garages table scoped by tenant_id."""

    def __init__(self) -> None:
        self._client = None
        self.table_name = 'garages'

    def _get_client(self):
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def listar_por_tenant(self, tenant_id: str) -> list[dict[str, Any]]:
        response = (
            self._get_client()
            .table(self.table_name)
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('id')
            .execute()
        )
        return response.data or []

    def obtener_por_id(self, tenant_id: str, garaje_id: int) -> dict[str, Any] | None:
        response = (
            self._get_client()
            .table(self.table_name)
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('id', garaje_id)
            .limit(1)
            .execute()
        )
        data = response.data or []
        return data[0] if data else None

    def crear(self, tenant_id: str, nombre: str, direccion: str, cupos_totales: int, niveles: int) -> dict[str, Any]:
        payload = {
            'tenant_id': tenant_id,
            'nombre': nombre,
            'direccion': direccion,
            'cupos_totales': cupos_totales,
            'niveles': niveles,
        }
        response = self._get_client().table(self.table_name).insert(payload).execute()
        data = response.data or []
        return data[0] if data else payload

    def actualizar(
        self,
        tenant_id: str,
        garaje_id: int,
        nombre: str,
        direccion: str,
        cupos_totales: int,
        niveles: int,
    ) -> dict[str, Any] | None:
        payload = {
            'nombre': nombre,
            'direccion': direccion,
            'cupos_totales': cupos_totales,
            'niveles': niveles,
        }
        response = (
            self._get_client()
            .table(self.table_name)
            .update(payload)
            .eq('tenant_id', tenant_id)
            .eq('id', garaje_id)
            .execute()
        )
        data = response.data or []
        return data[0] if data else None

    def eliminar(self, tenant_id: str, garaje_id: int) -> bool:
        existing = self.obtener_por_id(tenant_id=tenant_id, garaje_id=garaje_id)
        if not existing:
            return False

        self._get_client().table(self.table_name).delete().eq('tenant_id', tenant_id).eq('id', garaje_id).execute()
        return True


garaje_service = GarajeService()
