"""Compat entrypoint so `python -m app.main` runs the current SmartPark backend."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
DEPENDENCY_DIRS = [
    BACKEND_DIR / ".deps314",
    BACKEND_DIR / ".venv314" / "Lib" / "site-packages",
]

insert_index = 0
for dependency_dir in DEPENDENCY_DIRS:
    dependency_path = str(dependency_dir)
    if dependency_dir.exists() and dependency_path not in sys.path:
        sys.path.append(dependency_path)
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)

APP_FILE = BACKEND_DIR / "app.py"
SPEC = importlib.util.spec_from_file_location("smartpark_backend_app", APP_FILE)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"No fue posible cargar {APP_FILE}")

MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

create_app = MODULE.create_app
app = MODULE.app


if __name__ == "__main__":
    host = os.getenv("SMARTPARK_HOST", "127.0.0.1")
    port = int(os.getenv("SMARTPARK_PORT", "5000"))
    debug = os.getenv("SMARTPARK_DEBUG", "").strip().lower() in {"1", "true", "yes", "si", "on"}
    app.run(host=host, port=port, debug=debug)
