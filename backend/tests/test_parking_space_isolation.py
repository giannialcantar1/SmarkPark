from __future__ import annotations

import sys
import unittest
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

from flask import Flask, g


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

def _load_module(module_name: str, relative_path: str):
    module_path = BACKEND_DIR / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module

parking_service_module = _load_module("isolated_parking_service", "services/parking_service.py")
visitantes_module = _load_module("isolated_visitantes_route", "routes/visitantes.py")

from repositories.parking_space_repository import ParkingSpaceRepository
ParkingService = parking_service_module.ParkingService
register_visitor_entry = visitantes_module.register_visitor_entry


class ParkingSpaceIsolationTests(unittest.TestCase):
    def test_parking_service_does_not_fallback_to_default_garage_spaces(self) -> None:
        service = ParkingService()
        service.space_repository = MagicMock()
        service.space_repository.get_all.return_value = []
        service._create_default_spaces = MagicMock(return_value=[])

        result = service._spaces(garage_id="garage-a")

        self.assertEqual(result, [])
        service.space_repository.get_all.assert_called_once_with(
            filters=[{"column": "garage_id", "value": "garage-a", "optional": False}],
            order_candidates=["piso", "numero", "created_at"],
        )
        service._create_default_spaces.assert_called_once_with(garage_id="garage-a", count=20)

    @patch("repositories.parking_space_repository.update_rows")
    def test_repository_update_in_garage_includes_garage_filter(self, mock_update_rows: MagicMock) -> None:
        mock_update_rows.return_value = [{"id": "space-1", "garage_id": "garage-a", "estado": "ocupado"}]
        repository = ParkingSpaceRepository()

        updated = repository.update_in_garage("space-1", "garage-a", {"estado": "ocupado"})

        self.assertEqual(updated["garage_id"], "garage-a")
        _, kwargs = mock_update_rows.call_args
        self.assertEqual(
            kwargs["filters"],
            [
                {"column": "id", "value": "space-1", "optional": False},
                {"column": "garage_id", "value": "garage-a", "optional": False},
            ],
        )

    def test_visitor_entry_rejects_space_from_other_garage(self) -> None:
        app = Flask(__name__)

        with app.test_request_context(
            "/api/visitantes/entrada",
            method="POST",
            json={
                "nombre": "Visitante Demo",
                "placa": "ABC123",
                "espacio_id": "space-from-other-garage",
            },
        ):
            g.current_user_garage_id = "garage-a"

            with patch.object(visitantes_module, "_garage_spaces_index", return_value={"space-a": {"id": "space-a"}}):
                response, status_code = register_visitor_entry.__wrapped__()

        self.assertEqual(status_code, 400)
        self.assertEqual(response.get_json()["error"], "El espacio no pertenece a este garage")


if __name__ == "__main__":
    unittest.main()
