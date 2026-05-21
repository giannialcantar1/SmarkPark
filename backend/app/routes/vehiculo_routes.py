"""HTTP routes for vehiculos parking flow."""

from __future__ import annotations

import traceback

from flask import Blueprint, jsonify, request, session
from flask_cors import cross_origin
from postgrest.exceptions import APIError

from app.authz import requires_role
from app.garage_context import get_current_garage
from app.routes.notificaciones_routes import crear_notificacion
from app.services.parqueo_service import parqueo_service
from app.services.vehiculo_service import vehiculo_service

vehiculo_bp = Blueprint('vehiculos', __name__, url_prefix='/api/vehiculos')


@vehiculo_bp.route('/entrada', methods=['POST'], strict_slashes=False)
@requires_role('admin', 'portero')
def registrar_entrada() -> tuple:
    payload = request.get_json(silent=True) or {}
    placa = (payload.get('placa') or '').strip().upper()
    propietario = (payload.get('propietario') or '').strip()
    espacio_id = payload.get('espacio_id')
    duracion_estimada = payload.get('duracion_estimada')
    notas = (payload.get('notas') or '').strip()
    modelo = (payload.get('modelo') or '').strip()
    marca = (payload.get('marca') or '').strip()
    color = (payload.get('color') or '').strip()
    anio = payload.get('anio') or payload.get('año')
    usuario_email = session.get('email')

    if not placa:
        return jsonify({'error': 'La placa es requerida'}), 400

    try:
        garage_id = get_current_garage(required=True)
        registro = vehiculo_service.registrar_entrada(
            placa=placa,
            propietario=propietario or None,
            espacio_id=espacio_id,
            duracion_estimada=duracion_estimada,
            notas=notas or None,
            modelo=modelo or None,
            marca=marca or None,
            color=color or None,
            anio=anio,
            usuario_email=usuario_email,
            garage_id=garage_id,
        )
        if registro.get('espacio_id'):
            parqueo_service.marcar_ocupado(registro.get('espacio_id'), garage_id=garage_id)
        try:
            crear_notificacion(
                garage_id=garage_id,
                titulo='Vehículo ingresó al garaje',
                mensaje=f"{registro.get('placa') or placa} ingresó al espacio {registro.get('ubicacion') or registro.get('espacio_id') or 'sin asignar'}.",
                tipo='entrada',
            )
        except Exception:
            pass
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    'error': 'No fue posible registrar la entrada en Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        print(traceback.format_exc())
        return jsonify({'error': f'No fue posible registrar la entrada en Supabase: {str(exc)}'}), 500

    return jsonify({'mensaje': 'Entrada registrada correctamente', 'data': registro}), 201


@vehiculo_bp.route('/salida', methods=['POST'], strict_slashes=False)
@requires_role('admin', 'portero')
def registrar_salida() -> tuple:
    payload = request.get_json(silent=True) or {}
    placa = (payload.get('placa') or '').strip().upper()
    usuario_email = session.get('email')

    if not placa:
        return jsonify({'error': 'La placa es requerida'}), 400

    try:
        garage_id = get_current_garage(required=True)
        registro = vehiculo_service.registrar_salida(placa, usuario_email=usuario_email, garage_id=garage_id)
        if registro and registro.get('espacio_id'):
            parqueo_service.marcar_disponible(registro.get('espacio_id'), garage_id=garage_id)
        if registro:
            try:
                crear_notificacion(
                    garage_id=garage_id,
                    titulo='Vehículo salió del garaje',
                    mensaje=f"{registro.get('placa') or placa} salió del espacio {registro.get('ubicacion') or registro.get('espacio_id') or 'sin asignar'}.",
                    tipo='salida',
                )
            except Exception:
                pass
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        return (
            jsonify(
                {
                    'error': 'No fue posible registrar la salida en Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )

    if not registro:
        return jsonify({'error': 'No existe un vehiculo activo con esa placa'}), 404

    return (
        jsonify(
            {
                'mensaje': 'Salida registrada correctamente',
                'monto_total': registro.get('monto_total'),
                'data': registro,
            }
        ),
        200,
    )


@vehiculo_bp.route('/', methods=['GET'], strict_slashes=False)
def listar_vehiculos() -> tuple:
    try:
        data = vehiculo_service.listar_todos(garage_id=get_current_garage(required=True))
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        return (
            jsonify(
                {
                    'error': 'No fue posible listar vehiculos desde Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        return jsonify({'error': f'No fue posible listar vehiculos desde Supabase: {str(exc)}'}), 500
    return jsonify({'data': data}), 200


@vehiculo_bp.route('/activos', methods=['GET'], strict_slashes=False)
@cross_origin()
def listar_vehiculos_activos() -> tuple:
    try:
        data = vehiculo_service.listar_activos(garage_id=get_current_garage(required=True))
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        return (
            jsonify(
                {
                    'error': 'No fue posible listar vehiculos activos desde Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        return jsonify({'error': f'No fue posible listar vehiculos activos desde Supabase: {str(exc)}'}), 500
    return jsonify({'data': data}), 200


@vehiculo_bp.route('/logs', methods=['GET'], strict_slashes=False)
@requires_role('admin')
def listar_vehicle_logs() -> tuple:
    try:
        data = vehiculo_service.listar_logs(garage_id=get_current_garage(required=True))
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        return (
            jsonify(
                {
                    'error': 'No fue posible listar logs de vehiculos desde Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        return jsonify({'error': f'No fue posible listar logs de vehiculos: {str(exc)}'}), 500
    return jsonify({'data': data}), 200


@vehiculo_bp.route('/<vehiculo_id>', methods=['PUT'], strict_slashes=False)
@requires_role('admin')
def actualizar_vehiculo(vehiculo_id: str) -> tuple:
    payload = request.get_json(silent=True) or {}
    placa = (payload.get('placa') or '').strip().upper()
    propietario = (payload.get('propietario') or '').strip()
    modelo = (payload.get('modelo') or '').strip()
    marca = (payload.get('marca') or '').strip()
    color = (payload.get('color') or '').strip()
    anio = payload.get('anio') or payload.get('año')
    espacio_id = payload.get('space_id') or payload.get('espacio_id')
    estado = payload.get('status') or payload.get('estado')
    duracion_estimada = payload.get('duracion_estimada')
    notas = payload.get('notas')
    usuario_email = session.get('email')

    if not placa:
        return jsonify({'error': 'La placa es requerida'}), 400

    try:
        garage_id = get_current_garage(required=True)
        registro = vehiculo_service.actualizar_vehiculo(
            vehiculo_id=vehiculo_id,
            placa=placa,
            propietario=propietario or None,
            modelo=modelo or None,
            marca=marca or None,
            color=color or None,
            anio=anio,
            espacio_id=espacio_id,
            estado=estado,
            duracion_estimada=duracion_estimada,
            notas=notas,
            usuario_email=usuario_email,
            garage_id=garage_id,
        )
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403
    except APIError as exc:
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    'error': 'No fue posible actualizar el vehiculo en Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        print(traceback.format_exc())
        return jsonify({'error': f'No fue posible actualizar el vehiculo: {str(exc)}'}), 500

    return jsonify({'mensaje': 'Vehiculo actualizado correctamente', 'data': registro}), 200


@vehiculo_bp.route('/<vehiculo_id>', methods=['DELETE'], strict_slashes=False)
@requires_role('admin')
def eliminar_vehiculo(vehiculo_id: str) -> tuple:
    usuario_email = session.get('email')

    try:
        registro = vehiculo_service.eliminar_vehiculo(
            vehiculo_id,
            usuario_email=usuario_email,
            garage_id=get_current_garage(required=True),
        )
    except APIError as exc:
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    'error': 'No fue posible eliminar el vehiculo en Supabase.',
                    'code': exc.code,
                    'details': exc.message,
                }
            ),
            403 if exc.code == '42501' else 500,
        )
    except Exception as exc:
        print(traceback.format_exc())
        return jsonify({'error': f'No fue posible eliminar el vehiculo: {str(exc)}'}), 500

    if not registro:
        return jsonify({'error': 'No se encontro el vehiculo solicitado'}), 404

    return jsonify({'mensaje': 'Vehiculo eliminado correctamente', 'data': registro}), 200
