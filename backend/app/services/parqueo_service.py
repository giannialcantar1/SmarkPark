"""Service layer for parqueos visual assignment flow."""

from __future__ import annotations

import re
from typing import Any

import httpx
from postgrest.exceptions import APIError

from app.supabase_client import get_supabase_admin_client, get_supabase_client


class ParqueoService:
    """Provides read/update operations for parking spaces table."""

    def __init__(self) -> None:
        self._client = None
        self.table_name = 'parking_spaces'

    def _get_client(self):
        if self._client is None:
            # Preferimos la service role en backend para que las tablas carguen
            # aunque el proyecto tenga RLS estricto o politicas incompletas.
            self._client = get_supabase_admin_client() or get_supabase_client()
        return self._client

    @staticmethod
    def _execute_with_retry(operation):
        try:
            return operation()
        except httpx.RemoteProtocolError:
            return operation()

    @staticmethod
    def _error_text(exc: Exception) -> str:
        parts = [
            str(exc or ''),
            getattr(exc, 'message', None),
            getattr(exc, 'details', None),
            getattr(exc, 'hint', None),
        ]
        return ' '.join(str(part) for part in parts if part)

    @classmethod
    def _extract_missing_column(cls, exc: Exception, table_name: str) -> str | None:
        message = cls._error_text(exc)
        patterns = [
            rf"could not find the '([^']+)' column of '{re.escape(table_name)}' in the schema cache",
            rf"column\s+(?:public\.)?{re.escape(table_name)}\.\"?([^\s\"']+)\"?\s+does not exist",
            rf"column\s+\"?([^\s\"']+)\"?\s+of relation\s+\"?{re.escape(table_name)}\"?\s+does not exist",
        ]
        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    @classmethod
    def _is_missing_column_error(cls, exc: Exception, table_name: str, column_name: str) -> bool:
        missing = cls._extract_missing_column(exc, table_name)
        return str(missing or '').strip('"').lower() == str(column_name or '').strip('"').lower()

    @staticmethod
    def _first_value(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
        for key in keys:
            if key in row and row.get(key) not in (None, ''):
                return row.get(key)
        return default

    def listar(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        use_garage_filter = bool(garage_id)
        order_column_candidates = ['codigo', 'nombre', 'numero_mostrar', 'space_number', 'created_at', None]

        while True:
            order_column = next((column for column in order_column_candidates if column is not None), None)

            try:
                query = self._get_client().table(self.table_name).select('*')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                if order_column:
                    response = self._execute_with_retry(lambda: query.order(order_column).execute())
                else:
                    response = self._execute_with_retry(lambda: query.execute())
                rows = response.data or []
                return [self._normalize_row(row) for row in rows]
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if order_column and self._is_missing_column_error(exc, self.table_name, order_column):
                    order_column_candidates = [column for column in order_column_candidates if column != order_column]
                    continue
                raise

    def listar_disponibles(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        use_garage_filter = bool(garage_id)
        status_column_candidates = ['estado', 'status']

        while True:
            status_column = next((column for column in status_column_candidates if column is not None), None)
            try:
                query = self._get_client().table(self.table_name).select('*')
                if status_column:
                    query = query.eq(status_column, 'disponible')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                response = self._execute_with_retry(lambda: query.execute())
                return [self._normalize_row(row) for row in (response.data or [])]
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if status_column and self._is_missing_column_error(exc, self.table_name, status_column):
                    status_column_candidates = [column for column in status_column_candidates if column != status_column]
                    if status_column_candidates:
                        continue
                raise

    def listar_ocupados(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        return [row for row in self.listar(garage_id=garage_id) if row.get('estado') == 'ocupado']

    def _update_estado(self, parqueo_id: Any, estado: str, garage_id: str | None = None) -> dict[str, Any] | None:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para actualizar parqueos.')

        use_garage_filter = bool(garage_id)
        payload = {'estado': estado, 'status': estado}

        while True:
            try:
                query = self._get_client().table(self.table_name).update(payload)
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                response = self._execute_with_retry(lambda: query.eq('id', parqueo_id).execute())
                data = response.data or []
                return self._normalize_row(data[0]) if data else None
            except APIError as exc:
                missing_column = self._extract_missing_column(exc, self.table_name)
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if missing_column and missing_column in payload:
                    payload.pop(missing_column, None)
                    continue
                raise

    def marcar_ocupado(self, parqueo_id: Any, garage_id: str | None = None) -> dict[str, Any] | None:
        return self._update_estado(parqueo_id=parqueo_id, estado='ocupado', garage_id=garage_id)

    def marcar_disponible(self, parqueo_id: Any, garage_id: str | None = None) -> dict[str, Any] | None:
        return self._update_estado(parqueo_id=parqueo_id, estado='disponible', garage_id=garage_id)

    def crear(self, codigo: str, tipo: str | None, estado: str, garage_id: str | None = None) -> dict[str, Any]:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para crear parqueos.')

        payload = {
            'garage_id': garage_id,
            'codigo': codigo,
            'nombre': codigo,
            'numero_mostrar': codigo,
            'nivel': tipo,
            'piso': tipo,
            'estado': estado,
            'status': estado,
        }

        current_payload = dict(payload)
        while True:
            try:
                response = self._execute_with_retry(
                    lambda: self._get_client().table(self.table_name).insert(current_payload).execute()
                )
                data = response.data or []
                return self._normalize_row(data[0]) if data else self._normalize_row(current_payload)
            except APIError as exc:
                missing_column = self._extract_missing_column(exc, self.table_name)
                if missing_column and missing_column in current_payload:
                    current_payload.pop(missing_column, None)
                    continue
                raise

    def _normalize_row(self, row: dict[str, Any]) -> dict[str, Any]:
        codigo = self._first_value(row, 'codigo', 'nombre', 'numero_mostrar', 'code', 'space_number', default='')
        nivel = self._first_value(row, 'nivel', 'piso', 'floor', 'tipo', 'type', default='')
        estado = self._first_value(row, 'estado', 'status', default='disponible')
        vehiculo_id = self._first_value(row, 'vehiculo_id', 'vehicle_id')
        estado = str(estado or '').strip().lower() or ('ocupado' if vehiculo_id else 'disponible')

        return {
            **row,
            'garage_id': row.get('garage_id'),
            'codigo': codigo,
            'numero_mostrar': codigo,
            'nivel_mostrar': nivel,
            'nombre': codigo,
            'tipo': nivel,
            'estado': estado,
            'ocupado': estado == 'ocupado',
            'vehiculo_id': vehiculo_id,
        }


parqueo_service = ParqueoService()
