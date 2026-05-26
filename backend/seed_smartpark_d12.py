from __future__ import annotations

import json
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

from utils.supabase_client import insert_row, select_rows  # noqa: E402


GARAGE_ID = "d12e9e15-76fd-4cbb-9895-587a29e0cd0f"
USER_EMAIL = "giannisubervi@gmail.com"


def seed_spaces(report: dict[str, object]) -> None:
    existing = {
        str(row.get("numero") or row.get("codigo") or "").strip().upper()
        for row in select_rows("parking_spaces", limit=500)
        if str(row.get("garage_id") or "") == GARAGE_ID
    }
    inserted = 0
    for code in [f"A{i}" for i in range(1, 9)] + [f"B{i}" for i in range(1, 9)]:
        if code in existing:
            continue
        insert_row(
            "parking_spaces",
            {
                "garage_id": GARAGE_ID,
                "numero": code,
                "codigo": code,
                "piso": code[0],
                "nivel": code[0],
                "ocupado": False,
                "estado": "disponible",
                "tipo_espacio": "regular",
                "tipo": "regular",
            },
        )
        inserted += 1
    report["spaces_inserted"] = inserted


def seed_service_rate(report: dict[str, object]) -> None:
    rows = select_rows("service_rates", limit=100)
    has_target = any(str(row.get("garage_id") or "") == GARAGE_ID for row in rows)
    if has_target:
        report["service_rate_seeded"] = False
        return
    insert_row(
        "service_rates",
        {
            "garage_id": GARAGE_ID,
            "tipo_vehiculo": "auto",
            "tarifa_hora": 100,
            "tarifa_minima": 50,
            "tarifa_diaria": 500,
            "nombre": "Tarifa auto",
            "descripcion": "Tarifa base SmartPark",
            "precio_por_hora": 100,
            "monto": 100,
            "amount": 100,
            "rate": 100,
        },
    )
    report["service_rate_seeded"] = True


def seed_vehicle(report: dict[str, object]) -> None:
    users = select_rows("users", filters=[{"column": "email", "value": USER_EMAIL, "optional": False}], limit=5)
    owner = users[0] if users else None
    rows = select_rows("vehicles", limit=100)
    existing = next(
        (
            row
            for row in rows
            if str(row.get("garage_id") or "") == GARAGE_ID
            and str(row.get("placa") or row.get("plate") or "").strip().upper() == "ABC1234"
        ),
        None,
    )
    if existing:
        report["vehicle_seeded"] = False
        return
    insert_row(
        "vehicles",
        {
            "garage_id": GARAGE_ID,
            "placa": "ABC1234",
            "plate": "ABC1234",
            "marca": "Toyota",
            "modelo": "Corolla",
            "tipo": "auto",
            "color": "Blanco",
            "propietario_id": (owner or {}).get("id"),
            "usuario_id": (owner or {}).get("id"),
            "owner": "Gianni Subervi",
            "owner_name": "Gianni Subervi",
        },
    )
    report["vehicle_seeded"] = True


def main() -> None:
    report: dict[str, object] = {"garage_id": GARAGE_ID}
    seed_spaces(report)
    seed_service_rate(report)
    seed_vehicle(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
