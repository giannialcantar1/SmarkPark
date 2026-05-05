from __future__ import annotations

import importlib.util
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

from utils.supabase_client import ensure_user_profile, get_user_table_client, select_rows  # noqa: E402


def load_app():
    app_file = BACKEND_DIR / "app.py"
    spec = importlib.util.spec_from_file_location("smartpark_backend_app", app_file)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No fue posible cargar {app_file}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def main() -> None:
    auth_client = get_user_table_client(use_admin=False)
    auth_result = auth_client.auth.sign_in_with_password(
        {"email": "giannisubervi@gmail.com", "password": "SmartPark123"}
    )
    auth_user = getattr(auth_result, "user", None)
    synced_profile = ensure_user_profile(
        auth_user,
        garage_id="d12e9e15-76fd-4cbb-9895-587a29e0cd0f",
        name="Gianni Subervi",
        role="admin",
    )

    app = load_app()
    client = app.test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "giannisubervi@gmail.com", "password": "SmartPark123"},
    )
    login_json = login.get_json(silent=True) or {}
    token = login_json.get("token")
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    stats = client.get("/api/dashboard/stats", headers=headers)
    spaces = client.get("/api/parking-spaces", headers=headers)

    report = {
        "login_status": login.status_code,
        "login_body": login_json,
        "synced_profile": synced_profile,
        "users_rows": select_rows("users", limit=5),
        "stats_status": stats.status_code,
        "stats_body": stats.get_json(silent=True) or stats.get_data(as_text=True),
        "spaces_status": spaces.status_code,
        "spaces_count": len((spaces.get_json(silent=True) or {}).get("data") or []),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
