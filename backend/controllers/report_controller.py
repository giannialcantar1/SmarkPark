from __future__ import annotations

from flask import g, jsonify

from services import ReportService


class ReportController:
    def __init__(self) -> None:
        self.report_service = ReportService()

    def occupancy(self):
        data = self.report_service.generate_occupancy_report(garage_id=g.current_user_garage_id)
        return jsonify({"success": True, "data": data})

    def income(self):
        data = self.report_service.generate_income_report(garage_id=g.current_user_garage_id)
        return jsonify({"success": True, "data": data})

    def vehicles(self):
        return jsonify({"success": True, "data": self.report_service.generate_vehicle_report(garage_id=g.current_user_garage_id)})

    def users(self):
        return jsonify({"success": True, "data": self.report_service.generate_user_report(garage_id=g.current_user_garage_id)})
