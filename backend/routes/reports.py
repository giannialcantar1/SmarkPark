from __future__ import annotations

from flask import Blueprint

from controllers import ReportController
from utils.decorators import auth_required


reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")
controller = ReportController()


@reports_bp.get("/occupancy")
@auth_required
def occupancy_report():
    return controller.occupancy()


@reports_bp.get("/income")
@auth_required
def income_report():
    return controller.income()


@reports_bp.get("/vehicles")
@auth_required
def vehicles_report():
    return controller.vehicles()


@reports_bp.get("/users")
@auth_required
def users_report():
    return controller.users()
