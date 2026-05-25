from __future__ import annotations

from flask import g, jsonify, request, send_file

from services import ReportService


class ReportController:
    def __init__(self) -> None:
        self.report_service = ReportService()

    @staticmethod
    def _generated_by() -> dict:
        return {
            "id": g.current_user_id,
            "name": g.current_user_name,
            "email": g.current_user_email,
            "role": g.current_user_role,
        }

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

    def export_pbix(self):
        payload = request.get_json(silent=True) or {}

        try:
            export_file, filename = self.report_service.build_power_bi_import_bundle(
                payload=payload,
                garage_id=g.current_user_garage_id,
                generated_by=self._generated_by(),
            )
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

        response = send_file(
            export_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=filename,
        )
        response.headers["X-SmartPark-Requested-Format"] = "pbix"
        response.headers["X-SmartPark-Actual-Format"] = "power-bi-import-bundle"
        response.headers["X-SmartPark-Actual-Extension"] = ".zip"
        return response

    def export_parkings_xlsx(self):
        payload = request.get_json(silent=True) or {}

        try:
            export_file, filename = self.report_service.build_parking_report_workbook(
                payload=payload,
                garage_id=g.current_user_garage_id,
                generated_by=self._generated_by(),
            )
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

        return send_file(
            export_file,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )

    def export_morosidad_xlsx(self):
        payload = request.get_json(silent=True) or {}

        try:
            export_file, filename = self.report_service.build_standard_report_workbook(
                payload={
                    **payload,
                    "title": payload.get("title") or "Reporte de Morosidad",
                    "sheet_name": "Morosidad",
                },
                garage_id=g.current_user_garage_id,
                generated_by=self._generated_by(),
                table_name="SmartPark_Morosidad",
            )
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

        return send_file(
            export_file,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )
