from __future__ import annotations

from flask import Blueprint
from flask_cors import cross_origin

from config import Config
from controllers import ReportController
from utils.decorators import auth_required


reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")
controller = ReportController()
REPORT_EXPORT_CORS = {
    "origins": sorted(
        {
            *Config.FRONTEND_ORIGINS,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        }
    ),
    "methods": ["POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Garage-ID", "Accept"],
    "expose_headers": ["Content-Disposition", "Content-Type", "X-SmartPark-Actual-Extension"],
    "supports_credentials": True,
}


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


@reports_bp.post("/export-pbix")
@cross_origin(**REPORT_EXPORT_CORS)
@auth_required
def export_pbix_report():
    return controller.export_pbix()


@reports_bp.route("/export-parkings-xlsx", methods=["POST", "OPTIONS"])
@cross_origin(**REPORT_EXPORT_CORS)
@auth_required
def export_parkings_xlsx_report():
    return controller.export_parkings_xlsx()
