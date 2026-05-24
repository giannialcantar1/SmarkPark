from __future__ import annotations

from flask import Blueprint, jsonify

from utils.supabase_client import normalize_text, select_rows


garages_bp = Blueprint("garages", __name__, url_prefix="/api/garages")


def _normalize_public_garage(row: dict) -> dict:
    garage_id = row.get("garage_id") or row.get("tenant_id") or row.get("id")
    name = (
        row.get("company_name")
        or row.get("nombre")
        or row.get("name")
        or row.get("empresa")
        or "Garage sin nombre"
    )
    address = row.get("address") or row.get("direccion") or ""
    code = row.get("codigo") or row.get("code") or row.get("garage_code") or ""

    return {
        "id": garage_id,
        "garage_id": garage_id,
        "name": name,
        "nombre": name,
        "address": address,
        "direccion": address,
        "code": code,
        "codigo": code,
    }


def garage_exists(garage_id: str | None) -> bool:
    normalized_garage_id = normalize_text(garage_id)
    if not normalized_garage_id:
        return False

    for row in _load_public_garages():
        candidates = {
            normalize_text(row.get("garage_id")),
            normalize_text(row.get("tenant_id")),
            normalize_text(row.get("id")),
        }
        if normalized_garage_id in candidates:
            return True
    return False


def _load_public_garages() -> list[dict]:
    rows = select_rows(
        "garages",
        order_candidates=["nombre", "name", "company_name", "created_at"],
        limit=500,
    )
    if rows:
        return rows
    return select_rows(
        "garajes",
        order_candidates=["nombre", "name", "company_name", "created_at"],
        limit=500,
    )


@garages_bp.get("/list")
def list_public_garages():
    garages = [
        garage
        for garage in (_normalize_public_garage(row) for row in _load_public_garages())
        if garage.get("garage_id")
    ]
    garages.sort(key=lambda item: normalize_text(item.get("name")))
    return jsonify({"success": True, "data": garages}), 200
