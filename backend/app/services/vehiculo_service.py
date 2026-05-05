"""Service layer for vehiculos operations in Supabase."""

from __future__ import annotations

import json
import re
import traceback
from datetime import datetime, timezone
from math import ceil
from typing import Any

import httpx
from postgrest.exceptions import APIError

from app.supabase_client import get_supabase_admin_client, get_supabase_client


class VehiculoService:
    """Encapsulates parking entry/exit logic for vehicles table."""

    def __init__(self) -> None:
        self._client = None
        self.table_name = 'vehicles'
        self.logs_table_candidates = ['vehicle_logs', 'parking_history']
        self.tarifa_por_hora = 50

    def _get_client(self):
        if self._client is None:
            self._client = get_supabase_admin_client() or get_supabase_client()
        return self._client

    def _get_query_client(self):
        return self._get_client()

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

    def _execute_table_mutation(self, table_name: str, action_factory, payload: dict[str, Any]):
        current_payload = dict(payload)

        while True:
            try:
                response = self._execute_with_retry(lambda: action_factory(current_payload))
                return response, current_payload
            except APIError as exc:
                missing_column = self._extract_missing_column(exc, table_name)
                if missing_column and missing_column in current_payload:
                    current_payload.pop(missing_column, None)
                    continue
                raise

    def _resolve_logs_table_name(self) -> str | None:
        for table_name in self.logs_table_candidates:
            try:
                self._execute_with_retry(
                    lambda current_table=table_name: self._get_query_client().table(current_table).select('*').limit(1).execute()
                )
                return table_name
            except APIError as exc:
                if "could not find the table 'public." in str(exc).lower():
                    continue
                return table_name
            except Exception:
                return table_name
        return None

    def _obtener_tarifa_por_hora(self, garage_id: str | None) -> float:
        try:
            query = self._get_query_client().table('settings').select('hourly_rate')
            if garage_id:
                query = query.eq('garage_id', garage_id)
            response = self._execute_with_retry(lambda: query.order('created_at').limit(1).execute())
            rows = response.data or []
            if rows:
                value = rows[0].get('hourly_rate')
                if value not in (None, ''):
                    return float(value)
        except Exception as exc:
            if "could not find the table 'public.settings'" not in str(exc).lower():
                print(traceback.format_exc())
        return float(self.tarifa_por_hora)

    def _mapear(self, v: dict[str, Any]) -> dict[str, Any]:
        return {
            'id': v.get('id'),
            'placa': v.get('placa') or v.get('plate'),
            'marca': v.get('marca'),
            'modelo': v.get('modelo') or v.get('model'),
            'color': v.get('color'),
            'anio': v.get('año') or v.get('anio'),
            'propietario': v.get('propietario') or v.get('owner'),
            'owner': v.get('owner') or v.get('propietario'),
            'model': v.get('model') or v.get('modelo'),
            'espacio_id': v.get('space_id') or v.get('espacio_id'),
            'estado': v.get('status') or v.get('estado'),
            'status': v.get('status') or v.get('estado'),
            'hora_entrada': v.get('entry_time') or v.get('hora_entrada'),
            'hora_salida': v.get('exit_time') or v.get('hora_salida'),
            'monto_total': v.get('total_amount') or v.get('monto_total'),
            'duracion_estimada': v.get('duracion_estimada'),
            'notas': v.get('notas'),
            'garage_id': v.get('garage_id'),
            'created_at': v.get('created_at'),
        }

    def _registrar_log(
        self,
        accion: str,
        placa: str | None,
        usuario_email: str | None,
        garage_id: str | None,
        vehicle_id: str | None = None,
        detalles: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        logs_table_name = self._resolve_logs_table_name()
        if not logs_table_name:
            return None
        payload = {
            'vehicle_id': vehicle_id,
            'garage_id': garage_id,
            'accion': accion,
            'placa': placa,
            'usuario_email': usuario_email,
            'detalles': detalles or {},
        }
        response, persisted_payload = self._execute_table_mutation(
            logs_table_name,
            lambda current_payload: self._get_query_client().table(logs_table_name).insert(current_payload).execute(),
            payload,
        )
        data = response.data or []
        return data[0] if data else persisted_payload

    def registrar_entrada(
        self,
        placa: str,
        propietario: str | None = None,
        espacio_id: Any | None = None,
        duracion_estimada: str | None = None,
        notas: str | None = None,
        modelo: str | None = None,
        marca: str | None = None,
        color: str | None = None,
        anio: str | int | None = None,
        usuario_email: str | None = None,
        garage_id: str | None = None,
    ) -> dict[str, Any]:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para registrar vehiculos.')
        ahora = datetime.now(timezone.utc)
        payload: dict[str, Any] = {
            'placa': placa,
            'garage_id': garage_id,
            'status': 'dentro',
            'entry_time': ahora.isoformat(),
        }

        if propietario:
            payload['propietario'] = propietario
            payload['owner'] = propietario
        if modelo:
            payload['modelo'] = modelo
            payload['model'] = modelo
        if marca:
            payload['marca'] = marca
        if color:
            payload['color'] = color
        if anio not in (None, ''):
            payload['año'] = anio
        if espacio_id:
            payload['space_id'] = espacio_id
        if duracion_estimada:
            payload['duracion_estimada'] = duracion_estimada
        if notas:
            payload['notas'] = notas

        try:
            response, persisted_payload = self._execute_table_mutation(
                self.table_name,
                lambda current_payload: self._get_query_client().table(self.table_name).insert(current_payload).execute(),
                payload,
            )
            data = response.data or []
            registro = self._mapear(data[0]) if data else self._mapear(persisted_payload)
            self._registrar_log(
                accion='creado',
                placa=registro.get('placa'),
                usuario_email=usuario_email,
                garage_id=garage_id,
                vehicle_id=registro.get('id'),
                detalles={
                    'marca': registro.get('marca'),
                    'modelo': registro.get('modelo'),
                    'color': registro.get('color'),
                    'anio': registro.get('anio'),
                    'propietario': registro.get('propietario'),
                    'space_id': registro.get('espacio_id'),
                },
            )
            self._registrar_log(
                accion='entrada',
                placa=registro.get('placa'),
                usuario_email=usuario_email,
                garage_id=garage_id,
                vehicle_id=registro.get('id'),
                detalles={
                    'espacio_id': registro.get('espacio_id'),
                    'propietario': registro.get('propietario'),
                    'modelo': registro.get('modelo'),
                    'duracion_estimada': registro.get('duracion_estimada'),
                    'notas': registro.get('notas'),
                    'hora_entrada': registro.get('hora_entrada'),
                },
            )
            return registro
        except Exception:
            print(traceback.format_exc())
            raise

    def actualizar_vehiculo(
        self,
        vehiculo_id: str,
        placa: str,
        propietario: str | None = None,
        modelo: str | None = None,
        marca: str | None = None,
        color: str | None = None,
        anio: str | int | None = None,
        espacio_id: Any | None = None,
        estado: str | None = None,
        duracion_estimada: str | None = None,
        notas: str | None = None,
        usuario_email: str | None = None,
        garage_id: str | None = None,
    ) -> dict[str, Any]:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para actualizar vehiculos.')
        payload: dict[str, Any] = {
            'placa': placa,
        }
        if propietario is not None:
            payload['propietario'] = propietario
            payload['owner'] = propietario
        if modelo is not None:
            payload['modelo'] = modelo
            payload['model'] = modelo
        if marca is not None:
            payload['marca'] = marca
        if color is not None:
            payload['color'] = color
        if anio not in (None, ''):
            payload['año'] = anio
        if espacio_id is not None:
            payload['space_id'] = espacio_id
        if estado is not None:
            payload['status'] = estado
        if duracion_estimada is not None:
            payload['duracion_estimada'] = duracion_estimada
        if notas is not None:
            payload['notas'] = notas

        try:
            use_garage_filter = bool(garage_id)

            while True:
                try:
                    response, persisted_payload = self._execute_table_mutation(
                        self.table_name,
                        lambda current_payload: (
                            self._get_query_client()
                            .table(self.table_name)
                            .update(current_payload)
                            .eq('garage_id', garage_id)
                            .eq('id', vehiculo_id)
                            .execute()
                            if use_garage_filter
                            else self._get_query_client().table(self.table_name).update(current_payload).eq('id', vehiculo_id).execute()
                        ),
                        payload,
                    )
                    break
                except APIError as exc:
                    if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                        use_garage_filter = False
                        continue
                    raise
            data = response.data or []
            registro = self._mapear(data[0]) if data else self._mapear({'id': vehiculo_id, 'garage_id': garage_id, **persisted_payload})
            self._registrar_log(
                accion='editado',
                placa=registro.get('placa'),
                usuario_email=usuario_email,
                garage_id=garage_id,
                vehicle_id=vehiculo_id,
                detalles={
                    'propietario': registro.get('propietario'),
                    'modelo': registro.get('modelo'),
                    'marca': registro.get('marca'),
                    'color': registro.get('color'),
                    'anio': registro.get('anio'),
                    'space_id': registro.get('espacio_id'),
                    'status': registro.get('estado'),
                    'duracion_estimada': registro.get('duracion_estimada'),
                    'notas': registro.get('notas'),
                },
            )
            return registro
        except Exception:
            print(traceback.format_exc())
            raise

    def eliminar_vehiculo(
        self,
        vehiculo_id: str,
        usuario_email: str | None = None,
        garage_id: str | None = None,
    ) -> dict[str, Any] | None:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para eliminar vehiculos.')
        try:
            use_garage_filter = bool(garage_id)

            while True:
                try:
                    current = self._execute_with_retry(
                        lambda: (
                            self._get_query_client()
                            .table(self.table_name)
                            .select('*')
                            .eq('garage_id', garage_id)
                            .eq('id', vehiculo_id)
                            .limit(1)
                            .execute()
                            if use_garage_filter
                            else self._get_query_client().table(self.table_name).select('*').eq('id', vehiculo_id).limit(1).execute()
                        )
                    )
                    break
                except APIError as exc:
                    if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                        use_garage_filter = False
                        continue
                    raise
            rows = current.data or []
            if not rows:
                return None

            vehiculo = self._mapear(rows[0])
            while True:
                try:
                    self._execute_with_retry(
                        lambda: (
                            self._get_query_client()
                            .table(self.table_name)
                            .delete()
                            .eq('garage_id', garage_id)
                            .eq('id', vehiculo_id)
                            .execute()
                            if use_garage_filter
                            else self._get_query_client().table(self.table_name).delete().eq('id', vehiculo_id).execute()
                        )
                    )
                    break
                except APIError as exc:
                    if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                        use_garage_filter = False
                        continue
                    raise
            self._registrar_log(
                accion='eliminado',
                placa=vehiculo.get('placa'),
                usuario_email=usuario_email,
                garage_id=garage_id,
                vehicle_id=vehiculo_id,
                detalles=vehiculo,
            )
            return vehiculo
        except Exception:
            print(traceback.format_exc())
            raise

    def registrar_salida(
        self,
        placa: str,
        usuario_email: str | None = None,
        garage_id: str | None = None,
    ) -> dict[str, Any] | None:
        if not garage_id:
            raise RuntimeError('garage_id es requerido para registrar salidas.')
        use_garage_filter = bool(garage_id)
        status_column_candidates = ['status', 'estado']
        order_column_candidates = ['entry_time', 'hora_entrada', 'created_at', None]

        while True:
            status_column = next((column for column in status_column_candidates if column is not None), None)
            order_column = next((column for column in order_column_candidates if column is not None), None)

            try:
                query = self._get_query_client().table(self.table_name).select('*')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                query = query.eq('placa', placa).eq(status_column, 'dentro').limit(1)
                if order_column:
                    consulta = self._execute_with_retry(lambda: query.order(order_column, desc=True).execute())
                else:
                    consulta = self._execute_with_retry(lambda: query.execute())
                break
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if status_column and self._is_missing_column_error(exc, self.table_name, status_column):
                    status_column_candidates = [column for column in status_column_candidates if column != status_column]
                    if status_column_candidates:
                        continue
                if order_column and self._is_missing_column_error(exc, self.table_name, order_column):
                    order_column_candidates = [column for column in order_column_candidates if column != order_column]
                    continue
                raise
        activos = consulta.data or []
        if not activos:
            return None

        vehiculo = activos[0]
        hora_entrada_raw = vehiculo.get('entry_time') or vehiculo.get('hora_entrada')
        if not hora_entrada_raw:
            raise RuntimeError('El registro activo no tiene hora de entrada valida.')

        hora_entrada = self._parse_datetime(hora_entrada_raw)
        hora_salida = datetime.now(timezone.utc)
        total_segundos = max((hora_salida - hora_entrada).total_seconds(), 0)
        horas_cobradas = max(1, ceil(total_segundos / 3600))
        tarifa_por_hora = self._obtener_tarifa_por_hora(garage_id)
        monto_total = float(horas_cobradas * tarifa_por_hora)

        payload_update = {
            'exit_time': hora_salida.isoformat(),
            'hora_salida': hora_salida.isoformat(),
            'status': 'fuera',
            'estado': 'fuera',
            'total_amount': monto_total,
            'monto_total': monto_total,
        }

        while True:
            try:
                update_resp, persisted_payload = self._execute_table_mutation(
                    self.table_name,
                    lambda current_payload: (
                        self._get_query_client()
                        .table(self.table_name)
                        .update(current_payload)
                        .eq('garage_id', garage_id)
                        .eq('id', vehiculo['id'])
                        .execute()
                        if use_garage_filter
                        else self._get_query_client().table(self.table_name).update(current_payload).eq('id', vehiculo['id']).execute()
                    ),
                    payload_update,
                )
                break
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                raise
        updated = update_resp.data or []
        registro = self._mapear(updated[0]) if updated else self._mapear({**vehiculo, **persisted_payload})
        registro['horas_cobradas'] = horas_cobradas
        registro['tarifa_por_hora'] = tarifa_por_hora
        registro['tiempo_total_minutos'] = max(1, ceil(total_segundos / 60))
        self._registrar_log(
            accion='salida',
            placa=registro.get('placa'),
            usuario_email=usuario_email,
            garage_id=garage_id,
            vehicle_id=registro.get('id'),
            detalles={
                'hora_entrada': registro.get('hora_entrada'),
                'hora_salida': registro.get('hora_salida'),
                'monto_total': registro.get('monto_total'),
                'horas_cobradas': horas_cobradas,
            },
        )
        return registro

    def listar_todos(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        use_garage_filter = bool(garage_id)
        order_column_candidates = ['created_at', 'entry_time', 'hora_entrada', None]

        while True:
            order_column = next((column for column in order_column_candidates if column is not None), None)

            try:
                query = self._get_query_client().table(self.table_name).select('*')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                if order_column:
                    response = self._execute_with_retry(lambda: query.order(order_column, desc=True).execute())
                else:
                    response = self._execute_with_retry(lambda: query.execute())
                return [self._mapear(v) for v in (response.data or [])]
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if order_column and self._is_missing_column_error(exc, self.table_name, order_column):
                    order_column_candidates = [column for column in order_column_candidates if column != order_column]
                    continue
                raise

    def listar_activos(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        use_garage_filter = bool(garage_id)
        status_column_candidates = ['status', 'estado']
        order_column_candidates = ['entry_time', 'hora_entrada', 'created_at', None]

        while True:
            status_column = next((column for column in status_column_candidates if column is not None), None)
            order_column = next((column for column in order_column_candidates if column is not None), None)

            try:
                query = self._get_query_client().table(self.table_name).select('*').eq(status_column, 'dentro')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                if order_column:
                    response = self._execute_with_retry(lambda: query.order(order_column, desc=True).execute())
                else:
                    response = self._execute_with_retry(lambda: query.execute())
                return [self._mapear(v) for v in (response.data or [])]
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, self.table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if status_column and self._is_missing_column_error(exc, self.table_name, status_column):
                    status_column_candidates = [column for column in status_column_candidates if column != status_column]
                    if status_column_candidates:
                        continue
                if order_column and self._is_missing_column_error(exc, self.table_name, order_column):
                    order_column_candidates = [column for column in order_column_candidates if column != order_column]
                    continue
                raise

    def listar_logs(self, garage_id: str | None = None) -> list[dict[str, Any]]:
        logs_table_name = self._resolve_logs_table_name()
        if not logs_table_name:
            return []

        use_garage_filter = bool(garage_id)
        order_column_candidates = ['created_at', 'entry_time', None]

        while True:
            order_column = next((column for column in order_column_candidates if column is not None), None)
            try:
                query = self._get_query_client().table(logs_table_name).select('*')
                if use_garage_filter:
                    query = query.eq('garage_id', garage_id)
                if order_column:
                    response = self._execute_with_retry(lambda: query.order(order_column, desc=True).execute())
                else:
                    response = self._execute_with_retry(lambda: query.execute())
                rows = response.data or []
                break
            except APIError as exc:
                if use_garage_filter and self._is_missing_column_error(exc, logs_table_name, 'garage_id'):
                    use_garage_filter = False
                    continue
                if order_column and self._is_missing_column_error(exc, logs_table_name, order_column):
                    order_column_candidates = [column for column in order_column_candidates if column != order_column]
                    continue
                if "could not find the table 'public." in str(exc).lower():
                    return []
                raise
        for row in rows:
            detalles = row.get('detalles')
            if isinstance(detalles, str):
                try:
                    row['detalles'] = json.loads(detalles)
                except Exception:
                    pass
        return rows

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        normalized = value.replace('Z', '+00:00')
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)


vehiculo_service = VehiculoService()
