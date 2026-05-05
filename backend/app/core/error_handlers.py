"""Global exception handlers for consistent API error responses."""

from flask import Flask, jsonify

from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)


def register_exception_handlers(app: Flask) -> None:
    """Attach global exception handlers to Flask app."""

    @app.errorhandler(AppException)
    def app_exception_handler(exc: AppException) -> tuple:
        logger.warning('Application exception: %s', exc.message)
        return jsonify(
            {
                'error': {
                    'type': exc.code,
                    'message': exc.message,
                }
            }
        ), 400

    @app.errorhandler(Exception)
    def unhandled_exception_handler(exc: Exception) -> tuple:
        logger.exception('Unhandled exception: %s', str(exc))
        return jsonify(
            {
                'error': {
                    'type': 'internal_server_error',
                    'message': 'An unexpected error occurred.',
                }
            }
        ), 500