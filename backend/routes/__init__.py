from __future__ import annotations

from flask import Flask

from .alertas_acceso import alertas_acceso_bp
from .access_codes import access_codes_bp
from .auth import auth_bp
from .dashboard import dashboard_bp
from .monthly_plans import monthly_plans_bp
from .morosidad import morosidad_bp
from .notificaciones import notificaciones_bp
from .parking_sessions import parking_sessions_bp
from .parking_spaces import parking_spaces_bp
from .payments import payments_bp
from .reservas import reservas_bp
from .reports import reports_bp
from .settings import settings_bp
from .users import users_bp
from .vehicles import vehicles_bp
from .visitantes import visitantes_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(auth_bp)
    app.register_blueprint(access_codes_bp)
    app.register_blueprint(parking_spaces_bp)
    app.register_blueprint(vehicles_bp)
    app.register_blueprint(parking_sessions_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(monthly_plans_bp)
    app.register_blueprint(morosidad_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(notificaciones_bp)
    app.register_blueprint(alertas_acceso_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(visitantes_bp)
    app.register_blueprint(reservas_bp)
