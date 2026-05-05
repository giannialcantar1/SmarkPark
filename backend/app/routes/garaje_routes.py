"""HTTP routes for garajes multi-tenant CRUD endpoints."""

import os

from flask import Blueprint, jsonify, request
from postgrest.exceptions import APIError

from app.services.garaje_service import garaje_service

garaje_bp = Blueprint('garajes', __name__, url_prefix='/api/garajes')
TENANT_HEADER = os.getenv('MULTI_TENANT_HEADER', 'X-Tenant-ID')


def _get_tenant_id() -> str | None:
    return request.headers.get(TENANT_HEADER)


@garaje_bp.route('/', methods=['GET'])
def listar_garajes() -> tuple:
    tenant_id = _get_tenant_id()
    if not tenant_id:
        return jsonify({'error': f'Header requerido: {TENANT_HEADER}'}), 400

    try:
        data = garaje_service.listar_por_tenant(tenant_id=tenant_id)
        return jsonify({'data': data}), 200
    except APIError as exc:
        return jsonify({'error': 'No fue posible listar garajes.', 'code': exc.code, 'details': exc.message}), 500


@garaje_bp.route('/<int:garaje_id>', methods=['GET'])
def obtener_garaje(garaje_id: int) -> tuple:
    tenant_id = _get_tenant_id()
    if not tenant_id:
        return jsonify({'error': f'Header requerido: {TENANT_HEADER}'}), 400

    try:
        data = garaje_service.obtener_por_id(tenant_id=tenant_id, garaje_id=garaje_id)
    except APIError as exc:
        return jsonify({'error': 'No fue posible consultar el garaje.', 'code': exc.code, 'details': exc.message}), 500

    if not data:
        return jsonify({'error': 'Garaje no encontrado'}), 404

    return jsonify({'data': data}), 200


@garaje_bp.route('/', methods=['POST'])
def crear_garaje() -> tuple:
    tenant_id = _get_tenant_id()
    if not tenant_id:
        return jsonify({'error': f'Header requerido: {TENANT_HEADER}'}), 400

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get('nombre') or '').strip()
    direccion = (payload.get('direccion') or '').strip()
    cupos_totales = int(payload.get('cupos_totales', 0))
    niveles = int(payload.get('niveles', 1))

    if not nombre:
        return jsonify({'error': 'El campo nombre es requerido'}), 400

    try:
        data = garaje_service.crear(
            tenant_id=tenant_id,
            nombre=nombre,
            direccion=direccion,
            cupos_totales=cupos_totales,
            niveles=niveles,
        )
        return jsonify({'data': data, 'mensaje': 'Garaje creado correctamente'}), 201
    except APIError as exc:
        return jsonify({'error': 'No fue posible crear el garaje.', 'code': exc.code, 'details': exc.message}), 500


@garaje_bp.route('/<int:garaje_id>', methods=['PUT'])
def actualizar_garaje(garaje_id: int) -> tuple:
    tenant_id = _get_tenant_id()
    if not tenant_id:
        return jsonify({'error': f'Header requerido: {TENANT_HEADER}'}), 400

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get('nombre') or '').strip()
    direccion = (payload.get('direccion') or '').strip()
    cupos_totales = int(payload.get('cupos_totales', 0))
    niveles = int(payload.get('niveles', 1))

    if not nombre:
        return jsonify({'error': 'El campo nombre es requerido'}), 400

    try:
        data = garaje_service.actualizar(
            tenant_id=tenant_id,
            garaje_id=garaje_id,
            nombre=nombre,
            direccion=direccion,
            cupos_totales=cupos_totales,
            niveles=niveles,
        )
    except APIError as exc:
        return jsonify({'error': 'No fue posible actualizar el garaje.', 'code': exc.code, 'details': exc.message}), 500

    if not data:
        return jsonify({'error': 'Garaje no encontrado'}), 404

    return jsonify({'data': data, 'mensaje': 'Garaje actualizado correctamente'}), 200


@garaje_bp.route('/<int:garaje_id>', methods=['DELETE'])
def eliminar_garaje(garaje_id: int) -> tuple:
    tenant_id = _get_tenant_id()
    if not tenant_id:
        return jsonify({'error': f'Header requerido: {TENANT_HEADER}'}), 400

    try:
        deleted = garaje_service.eliminar(tenant_id=tenant_id, garaje_id=garaje_id)
    except APIError as exc:
        return jsonify({'error': 'No fue posible eliminar el garaje.', 'code': exc.code, 'details': exc.message}), 500

    if not deleted:
        return jsonify({'error': 'Garaje no encontrado'}), 404

    return jsonify({'mensaje': 'Garaje eliminado correctamente'}), 200
