from __future__ import annotations

from flask import Blueprint

from controllers import ParkingController
from utils.decorators import auth_required


parking_sessions_bp = Blueprint("parking_sessions", __name__, url_prefix="/api/parking-sessions")
controller = ParkingController()


@parking_sessions_bp.get("")
@auth_required
def list_sessions():
    return controller.list_sessions()


@parking_sessions_bp.post("/entry")
@auth_required
def register_entry():
    return controller.entry()


@parking_sessions_bp.post("/exit")
@auth_required
def register_exit():
    return controller.exit()


@parking_sessions_bp.get("/active")
@auth_required
def active_sessions():
    return controller.active_sessions()
