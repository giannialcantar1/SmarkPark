from __future__ import annotations

from flask import Blueprint, g, jsonify

from utils.decorators import auth_required
from utils.supabase_client import get_supabase_admin_client, normalize_text, parse_datetime, select_rows


notificaciones_bp = Blueprint("notificaciones", __name__, url_prefix="/api/notificaciones")


def _same_garage(row: dict) -> bool:
    row_garage = normalize_text(row.get("garage_id"))
    current_garage = normalize_text(g.current_user_garage_id)
    if not current_garage or not row_garage:
        return False
    return row_garage == current_garage


@notificaciones_bp.get("")
@auth_required
def get_notificaciones():
    try:
        notifications_rows = select_rows(
            "notificaciones",
            order_candidates=["created_at", "fecha"],
            desc=True,
            limit=50,
        )
        access_alert_rows = select_rows(
            "alertas_acceso",
            order_candidates=["created_at", "fecha"],
            desc=True,
            limit=20,
        )

        notifications = []

        for row in notifications_rows:
            if not _same_garage(row):
                continue

            timestamp = parse_datetime(row.get("created_at") or row.get("fecha"))
            notifications.append({
                "id": row.get("id"),
                "type": normalize_text(row.get("tipo")) or "info",
                "title": row.get("titulo") or "Notificacion",
                "message": row.get("mensaje") or "",
                "read": bool(row.get("leida") or False),
                "created_at": timestamp.isoformat() if timestamp else None,
                "source": "notificacion",
            })

        for row in access_alert_rows:
            if not _same_garage(row):
                continue

            timestamp = parse_datetime(row.get("created_at") or row.get("fecha"))
            alert_type = normalize_text(row.get("tipo") or row.get("tipo_alerta")) or "acceso_denegado"
            route = row.get("ruta_denegada") or row.get("route") or "Sin ruta"
            reason = row.get("descripcion") or row.get("reason") or "Incidente de acceso detectado"
            title = "Login fallido" if alert_type == "login_fallido" else "Acceso denegado"
            notifications.append({
                "id": f"alerta-{row.get('id')}",
                "type": alert_type,
                "title": title,
                "message": f"{route} - {reason}",
                "read": normalize_text(row.get("estado")) == "leida",
                "created_at": timestamp.isoformat() if timestamp else None,
                "source": "alerta",
            })

        notifications.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return jsonify({"success": True, "data": notifications[:50]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@notificaciones_bp.post("/mark-read/<notification_id>")
@auth_required
def mark_notification_read(notification_id):
    try:
        client = get_supabase_admin_client()
        if client is None:
            return jsonify({"success": False, "error": "Cliente admin de Supabase no disponible"}), 500

        current_garage = normalize_text(g.current_user_garage_id)
        if not current_garage:
            return jsonify({"success": False, "error": "garage_id de la sesion no disponible"}), 400

        if str(notification_id).startswith("alerta-"):
            alert_id = str(notification_id).replace("alerta-", "", 1)
            client.from_("alertas_acceso").update({"estado": "leida"}).eq("id", alert_id).eq("garage_id", current_garage).execute()
            return jsonify({"success": True, "message": "Alerta marcada como leida"})

        client.from_("notificaciones").update({"leida": True}).eq("id", notification_id).eq("garage_id", current_garage).execute()
        return jsonify({"success": True, "message": "Notificacion marcada como leida"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
