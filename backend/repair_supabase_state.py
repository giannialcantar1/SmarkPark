from __future__ import annotations

import json
import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
DEPENDENCY_DIRS = [
    BACKEND_DIR / ".deps314",
    BACKEND_DIR / ".venv314" / "Lib" / "site-packages",
]

for dependency_dir in DEPENDENCY_DIRS:
    dependency_path = str(dependency_dir)
    if dependency_dir.exists() and dependency_path not in sys.path:
        sys.path.append(dependency_path)
sys.path.insert(0, str(BACKEND_DIR))

from config import Config  # noqa: E402
from utils.supabase_client import insert_row, normalize_parking_space, normalize_text, select_rows, update_rows  # noqa: E402


DEFAULT_GARAGE_ID = Config.DEFAULT_GARAGE_ID


def infer_floor(code: str) -> str | None:
    match = re.match(r"([A-Za-z])", str(code or "").strip())
    return match.group(1).upper() if match else None


def repair_spaces(report: dict[str, object]) -> None:
    rows = select_rows("parking_spaces", order_candidates=["codigo", "numero", "created_at"])
    existing_codes: set[str] = set()
    fixed = 0

    for row in rows:
        normalized = normalize_parking_space(row)
        code = str(normalized.get("numero") or normalized.get("code") or "").strip().upper()
        if code:
            existing_codes.add(code)

        payload: dict[str, object] = {}
        if not row.get("garage_id"):
            payload["garage_id"] = DEFAULT_GARAGE_ID
        if not row.get("numero") and code:
            payload["numero"] = code
        if not row.get("piso"):
            inferred_floor = infer_floor(code)
            if inferred_floor:
                payload["piso"] = inferred_floor
        if row.get("ocupado") is None:
            payload["ocupado"] = normalized.get("occupied", False)
        if not row.get("tipo_espacio"):
            payload["tipo_espacio"] = row.get("tipo") or "regular"

        if payload and row.get("id"):
            update_rows(
                "parking_spaces",
                payload=payload,
                filters=[{"column": "id", "value": row["id"], "optional": False}],
            )
            fixed += 1

    for code in [f"A{i}" for i in range(1, 9)] + [f"B{i}" for i in range(1, 9)]:
        if code in existing_codes:
            continue
        insert_row(
            "parking_spaces",
            {
                "codigo": code,
                "numero": code,
                "piso": infer_floor(code),
                "ocupado": False,
                "tipo_espacio": "regular",
                "tipo": "Estándar",
                "estado": "disponible",
                "garage_id": DEFAULT_GARAGE_ID,
            },
        )
        existing_codes.add(code)
        fixed += 1

    report["parking_spaces"] = {
        "rows_before": len(rows),
        "rows_after": len(existing_codes),
        "actions": fixed,
    }


def repair_service_rates(report: dict[str, object]) -> None:
    try:
        rows = select_rows(
            "service_rates",
            filters=[{"column": "garage_id", "value": DEFAULT_GARAGE_ID, "optional": True}],
            limit=5,
        )
    except Exception:
        rows = select_rows("service_rates", limit=5)
    if rows:
        report["service_rates"] = {"rows": len(rows), "seeded": False}
        return

    insert_row(
        "service_rates",
        {
            "nombre": "Tarifa auto",
            "descripcion": "Tarifa por hora para autos",
            "tipo_vehiculo": "auto",
            "tarifa_hora": 100,
            "tarifa_minima": 50,
            "tarifa_diaria": 500,
            "monto": 100,
            "amount": 100,
            "rate": 100,
            "precio_por_hora": 100,
            "garage_id": DEFAULT_GARAGE_ID,
        },
    )
    report["service_rates"] = {"rows": 1, "seeded": True}


def repair_vehicles(report: dict[str, object]) -> None:
    rows = select_rows("vehicles", order_candidates=["created_at", "creado_en"])
    fixed = 0
    for row in rows:
        payload: dict[str, object] = {}
        if not row.get("garage_id"):
            payload["garage_id"] = DEFAULT_GARAGE_ID
        placa = row.get("placa") or row.get("plate") or row.get("codigo")
        if not row.get("placa") and placa:
            payload["placa"] = str(placa).strip().upper()
        if not row.get("tipo") and row.get("vehicle_type"):
            payload["tipo"] = row.get("vehicle_type")
        if payload and row.get("id"):
            update_rows(
                "vehicles",
                payload=payload,
                filters=[{"column": "id", "value": row["id"], "optional": False}],
            )
            fixed += 1

    report["vehicles"] = {"rows": len(rows), "actions": fixed}


def main() -> None:
    report: dict[str, object] = {"garage_id": DEFAULT_GARAGE_ID}
    repair_spaces(report)
    repair_service_rates(report)
    repair_vehicles(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
