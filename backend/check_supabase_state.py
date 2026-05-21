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

from config import Config  # noqa: E402
from utils.supabase_client import select_rows  # noqa: E402


REQUIRED_TABLES = [
    "users",
    "vehicles",
    "parking_spaces",
    "parking_sessions",
    "payments",
    "service_rates",
    "notifications",
    "access_alerts",
    "auth_logs",
    "parking_history",
]


def main() -> None:
    report: dict[str, object] = {
        "supabase_url": Config.SUPABASE_URL,
        "has_anon_key": bool(Config.SUPABASE_KEY),
        "has_service_role_key": bool(Config.SUPABASE_SERVICE_ROLE_KEY),
        "tables": {},
    }

    for table_name in REQUIRED_TABLES:
        try:
            rows = select_rows(table_name, limit=5)
            report["tables"][table_name] = {
                "ok": True,
                "sample_count": len(rows),
                "sample": rows[:2],
            }
        except Exception as exc:
            report["tables"][table_name] = {
                "ok": False,
                "error": str(exc),
            }

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
