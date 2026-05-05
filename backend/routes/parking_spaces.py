from __future__ import annotations

from flask import Blueprint

from controllers import ParkingController
from utils.decorators import auth_required


parking_spaces_bp = Blueprint("parking_spaces", __name__, url_prefix="/api/parking-spaces")
controller = ParkingController()


@parking_spaces_bp.get("")
@auth_required
def list_parking_spaces():
    return controller.list_spaces()


@parking_spaces_bp.get("/stats")
@auth_required
def parking_spaces_stats():
    return controller.get_stats()


@parking_spaces_bp.get("/floor/<floor>")
@auth_required
def parking_spaces_by_floor(floor: str):
    return controller.list_spaces()


@parking_spaces_bp.put("/<space_id>")
@auth_required
def update_parking_space(space_id: str):
    return controller.update_space(space_id)
