"""API routes package."""

from app.routes.auth_routes import auth_bp
from app.routes.garaje_routes import garaje_bp
from app.routes.health import health_bp
from app.routes.notificaciones_routes import notificaciones_bp
from app.routes.otp_routes import otp_bp
from app.routes.parqueo_routes import parqueo_bp
from app.routes.user_routes import user_bp
from app.routes.vehiculo_routes import vehiculo_bp

__all__ = ['auth_bp', 'garaje_bp', 'health_bp', 'notificaciones_bp', 'otp_bp', 'parqueo_bp', 'user_bp', 'vehiculo_bp']
