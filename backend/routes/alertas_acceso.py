from __future__ import annotations

from flask import Blueprint, g, jsonify

from utils.decorators import auth_required
from utils.supabase_client import normalize_text, parse_datetime, select_rows


alertas_acceso_bp = Blueprint("alertas_acceso", __name__, url_prefix="/api/alertas-acceso")


@alertas_acceso_bp.get("")
@auth_required
def get_alertas_acceso():
    try:
        rows = select_rows(
            "alertas_acceso",
            order_candidates=["created_at", "fecha"],
            desc=True,
            limit=50,
        )
        alerts = []
        current_garage = normalize_text(g.current_user_garage_id)

        for row in rows:
            row_garage = normalize_text(row.get("garage_id"))
            if row_garage and current_garage and row_garage != current_garage:
                continue

            timestamp = parse_datetime(row.get("created_at") or row.get("fecha"))
            alert_type = normalize_text(row.get("tipo") or row.get("tipo_alerta")) or "acceso_denegado"
            alerts.append({
                "id": row.get("id"),
                "email": row.get("email"),
                "rol": row.get("rol") or row.get("role"),
                "tipo": alert_type,
                "tipo_alerta": alert_type,
                "ruta_denegada": row.get("ruta_denegada") or row.get("route"),
                "descripcion": row.get("descripcion") or row.get("reason") or "",
                "estado": normalize_text(row.get("estado")) or "pendiente",
                "created_at": timestamp.isoformat() if timestamp else None,
            })

        return jsonify({"success": True, "data": alerts})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
