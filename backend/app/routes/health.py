"""Flask blueprints for health endpoints."""

from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__, url_prefix='/api/health')


@health_bp.route('/', methods=['GET'])
def root() -> tuple:
    return jsonify({'mensaje': 'Servidor funcionando correctamente'}), 200


@health_bp.route('/check', methods=['GET'])
def health_check() -> tuple:
    return jsonify({'status': 'ok', 'service': 'SmartPark API'}), 200
